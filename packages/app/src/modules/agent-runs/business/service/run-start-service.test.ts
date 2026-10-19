import { readFileSync } from 'node:fs';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AgentTool } from '../../../../shared/agent-tools.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../shared/ticket-type/ticket-type.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeCommandLabeler,
  FakeCommandLabelRepository,
  FakeRunAnswerWaits,
  FakeRunRepository,
  FakeRunTranscripts,
  FakeSessionFeed,
  FakeProjectPort,
  FakeWorktrees,
  SequentialIdentifiers,
} from '../../testing/fake-agent-runs-ports.js';
import { buildCheckpointResumePrompt } from '../domain/functions/build-checkpoint-resume-prompt.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { RunEnding } from '../domain/types/run-ending.js';
import type { RunWait } from '../domain/types/run-wait.js';
import type { Run } from '../domain/types/run.js';
import type { SessionEvent } from '../domain/types/session-event.js';
import type { StartRunRequest } from '../domain/types/start-run-request.js';
import { RunAlreadyActiveError } from '../errors/run-already-active-error.js';
import { RunNotResumableError } from '../errors/run-not-resumable-error.js';
import { RunTargetNotFoundError } from '../errors/run-target-not-found-error.js';
import { WorktreeSetupFailedError } from '../errors/worktree-setup-failed-error.js';
import { mapSdkMessage } from '../../infrastructure/session/map-sdk-message.js';
import { CommandLabelService } from './command-label-service.js';
import { RunStartService } from './run-start-service.js';

type BuildOptions = {
  readonly now?: string;
  readonly tools?: ReadonlyArray<AgentTool>;
  readonly projectPort?: FakeProjectPort;
  readonly commandLabeler?: FakeCommandLabeler;
  readonly finish?: (runId: string, ending: RunEnding) => Promise<void>;
};

const defaultTarget = {
  checkoutPath: '/checkouts/aisf',
  repositoryName: 'aisf',
};

function buildService(options: BuildOptions = {}) {
  const runRepository = new FakeRunRepository();
  const agentSessions = new FakeAgentSessions();
  const worktrees = new FakeWorktrees();
  const runAnswerWaits = new FakeRunAnswerWaits();
  const runTranscripts = new FakeRunTranscripts();
  const sessionFeed = new FakeSessionFeed();
  const events = new FakeEventPublisher();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const finishCalls: Array<{ runId: string; ending: RunEnding }> = [];
  const runEndService = {
    finish:
      options.finish ??
      (async (runId: string, ending: RunEnding): Promise<void> => {
        finishCalls.push({ runId, ending });
      }),
  };
  const commandLabeler = options.commandLabeler ?? new FakeCommandLabeler();
  const service = new RunStartService({
    commandLabelService: new CommandLabelService({
      commandLabelRepository: new FakeCommandLabelRepository(),
      commandLabeler,
    }),
    runRepository,
    worktrees,
    projectPort: options.projectPort ?? new FakeProjectPort(defaultTarget),
    agentSessions,
    runTranscripts,
    sessionFeed,
    runAnswerWaits,
    identifiers: new SequentialIdentifiers(),
    clock: new FakeClock(options.now ?? '2026-09-29T10:00:00.000Z'),
    events,
    logger,
    runEndService,
    tools: () => options.tools ?? [],
    worktreesDirectory: '/worktrees',
    windowMilliseconds: 3_600_000,
  });
  return {
    service,
    runRepository,
    agentSessions,
    worktrees,
    runTranscripts,
    sessionFeed,
    runAnswerWaits,
    events,
    logger,
    finishCalls,
    commandLabeler,
  };
}

function runningEvents(events: FakeEventPublisher) {
  return events.emittedEvents.filter(({ name }) => name === 'run.waiting');
}

describe('RunStartService', () => {
  describe('start', () => {
    const startRequest = {
      projectId: 'moritz/aisf',
      ticketNumber: 137,
      mode: 'afk',
      ticketTitle: 'The runner takes a ticket',
      status: 'ready' as TicketStatus,
      types: [] as ReadonlyArray<TicketType>,
    } satisfies StartRunRequest;

    function buildStartSubject() {
      const executedContexts: unknown[] = [];
      const tools: AgentTool[] = [
        {
          name: 'aisf_probe',
          description: 'A probe tool',
          inputShape: { value: z.string() },
          execute: async (_input, runContext) => {
            executedContexts.push(runContext);
            return { text: 'probed' };
          },
        },
        {
          name: 'aisf_ending',
          description: 'A tool that ends the run',
          inputShape: {},
          execute: async () => ({ text: 'ended', ending: { kind: 'parked', blockerNumber: 42 } }),
        },
      ];
      return { ...buildService({ tools }), executedContexts };
    }

    it('should return a running run on the ticket branch and worktree when nothing else is running', async () => {
      const { service, runRepository } = buildStartSubject();

      const run = await service.start(startRequest);

      expect(run).toEqual({
        id: 'id-1',
        projectId: 'moritz/aisf',
        ticketNumber: 137,
        stage: 'implement',
        mode: 'afk',
        sessionId: 'id-2',
        worktreePath: '/worktrees/aisf/137',
        branchName: 'aisf/137-the-runner-takes-a-ticket',
        state: 'running',
        startedAt: '2026-09-29T10:00:00.000Z',
      });
      expect(runRepository.runs.get('id-1')).toEqual(run);
    });

    it('should ensure the worktree on the ticket branch when the run starts', async () => {
      const { service, worktrees } = buildStartSubject();

      await service.start(startRequest);

      expect(worktrees.ensuredSpecs).toEqual([
        {
          checkoutPath: '/checkouts/aisf',
          worktreePath: '/worktrees/aisf/137',
          branchName: 'aisf/137-the-runner-takes-a-ticket',
        },
      ]);
    });

    it('should start the session with the preset id, the implement command and the stage model when the run starts', async () => {
      const { service, agentSessions } = buildStartSubject();

      await service.start(startRequest);

      expect(agentSessions.startedSpecs).toHaveLength(1);
      expect(agentSessions.startedSpecs[0]).toMatchObject({
        sessionId: 'id-2',
        worktreePath: '/worktrees/aisf/137',
        prompt: '/aisf:implement-ticket 137',
        model: 'sonnet',
      });
    });

    it('should pass the latest run end as --since when an implement run starts on an in-review ticket', async () => {
      const { service, agentSessions, runRepository } = buildStartSubject();
      runRepository.runs.set(
        'earlier',
        buildRun({
          id: 'earlier',
          state: 'settled',
          startedAt: '2026-10-18T08:00:00.000Z',
          endedAt: '2026-10-18T09:00:00.000Z',
        }),
      );

      await service.start({ ...startRequest, status: 'in-review' });

      expect(agentSessions.startedSpecs[0]?.prompt).toBe(
        '/aisf:implement-ticket 137 --since 2026-10-18T09:00:00.000Z',
      );
    });

    it('should leave out --since when the in-review ticket has no earlier run', async () => {
      const { service, agentSessions } = buildStartSubject();

      await service.start({ ...startRequest, status: 'in-review' });

      expect(agentSessions.startedSpecs[0]?.prompt).toBe('/aisf:implement-ticket 137');
    });

    it('should leave out --since when the ready ticket has an earlier run that ended', async () => {
      const { service, agentSessions, runRepository } = buildStartSubject();
      runRepository.runs.set(
        'earlier',
        buildRun({
          id: 'earlier',
          state: 'settled',
          startedAt: '2026-10-18T08:00:00.000Z',
          endedAt: '2026-10-18T09:00:00.000Z',
        }),
      );

      await service.start(startRequest);

      expect(agentSessions.startedSpecs[0]?.prompt).toBe('/aisf:implement-ticket 137');
    });

    it.each<[string, ReadonlyArray<TicketType>, 'spike' | 'implement', string, string]>([
      ['a spike', ['spike'], 'spike', '/aisf:spike 137', 'opus'],
      ['both ui and spike', ['ui', 'spike'], 'spike', '/aisf:spike 137', 'opus'],
      ['another type', ['enhancement'], 'implement', '/aisf:implement-ticket 137', 'sonnet'],
      ['no type', [], 'implement', '/aisf:implement-ticket 137', 'sonnet'],
    ])(
      'should save the stage, prompt and model of the matching skill when the ticket is %s',
      async (_name, types, stage, prompt, model) => {
        const { service, agentSessions } = buildStartSubject();

        const run = await service.start({ ...startRequest, types });

        expect(run.stage).toBe(stage);
        expect(agentSessions.startedSpecs[0]).toMatchObject({ prompt, model });
      },
    );

    it.each<[string, TicketStatus, 'create' | 'plan', string, string]>([
      ['an idea', 'idea', 'create', '/aisf:create-ticket 137', 'sonnet'],
      ['a plan ticket', 'plan', 'plan', '/aisf:plan-ticket 137', 'opus'],
    ])(
      'should save the stage, prompt and model of the authoring skill when the ticket is %s',
      async (_name, status, stage, prompt, model) => {
        const { service, agentSessions } = buildStartSubject();

        const run = await service.start({ ...startRequest, status });

        expect(run.stage).toBe(stage);
        expect(agentSessions.startedSpecs[0]).toMatchObject({ prompt, model });
      },
    );

    it('should ensure a detached worktree without a branch in its own directory when an authoring run starts', async () => {
      const { service, worktrees } = buildStartSubject();

      const run = await service.start({ ...startRequest, status: 'plan' });

      expect(run.branchName).toBe('');
      expect(run.worktreePath).toBe('/worktrees/aisf/137-authoring');
      expect(worktrees.ensuredSpecs).toEqual([]);
      expect(worktrees.detachedSpecs).toEqual([
        { checkoutPath: '/checkouts/aisf', worktreePath: '/worktrees/aisf/137-authoring' },
      ]);
    });

    it('should refresh the detached worktree on every start when an authoring run starts twice', async () => {
      const { service, runRepository, worktrees } = buildStartSubject();

      await service.start({ ...startRequest, status: 'idea' });
      await runRepository.markSettled('id-1');
      await service.start({ ...startRequest, status: 'idea' });

      expect(worktrees.detachedSpecs).toHaveLength(2);
    });

    it('should throw RunAlreadyActiveError and start nothing when the ticket already has a running run', async () => {
      const { service, runRepository, worktrees, agentSessions } = buildStartSubject();
      await runRepository.insert(buildRun({ id: 'other-run' }));

      await expect(service.start(startRequest)).rejects.toThrow(RunAlreadyActiveError);

      expect(worktrees.ensuredSpecs).toEqual([]);
      expect(agentSessions.startedSpecs).toEqual([]);
    });

    it('should start the run when another ticket of the project is running', async () => {
      const { service, runRepository, agentSessions } = buildStartSubject();
      await runRepository.insert(buildRun({ id: 'other-run', ticketNumber: 12 }));

      await service.start(startRequest);

      expect(agentSessions.startedSpecs).toHaveLength(1);
    });

    it('should throw RunTargetNotFoundError and insert nothing when the project or ticket is unknown', async () => {
      const { service, runRepository } = buildService({
        projectPort: new FakeProjectPort(undefined),
      });

      await expect(service.start(startRequest)).rejects.toThrow(RunTargetNotFoundError);

      expect(runRepository.runs.size).toBe(0);
    });

    it('should not launch the session when the run ended during worktree setup', async () => {
      const { service, runRepository, worktrees, agentSessions } = buildStartSubject();
      const ensure = worktrees.ensure.bind(worktrees);
      worktrees.ensure = async (spec) => {
        await ensure(spec);
        await runRepository.recordEnding('id-1', { kind: 'stopped' }, '2026-09-29T10:00:01.000Z');
      };

      await service.start(startRequest);

      expect(agentSessions.startedSpecs).toEqual([]);
    });

    it('should end the run as crashed and rethrow when the worktree cannot be set up', async () => {
      const { service, worktrees, finishCalls, agentSessions } = buildStartSubject();
      worktrees.failure = new WorktreeSetupFailedError('git worktree add failed');

      await expect(service.start(startRequest)).rejects.toThrow(WorktreeSetupFailedError);

      expect(finishCalls).toEqual([
        { runId: 'id-1', ending: { kind: 'crashed', reason: 'git worktree add failed' } },
      ]);
      expect(agentSessions.startedSpecs).toEqual([]);
    });

    it('should publish the transcript prompt before the first delta and entry when the session streams', async () => {
      const { service, agentSessions, finishCalls, runTranscripts, sessionFeed } =
        buildStartSubject();
      runTranscripts.sessionEntries = [
        { kind: 'prompt', id: 'p#0', text: 'earlier prompt' },
        { kind: 'text', id: 'a#0', text: 'answer' },
        { kind: 'prompt', id: 'p2#0', text: 'implement #12' },
      ];
      await service.start(startRequest);
      const entry = { kind: 'text', id: 'u#0', text: 'Hello' } as const;

      agentSessions.push('id-2', { kind: 'text-delta', opensBlock: true, text: 'Hel' });
      agentSessions.push('id-2', { kind: 'entry', entry });
      agentSessions.push('id-2', { kind: 'completed' });

      await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
      expect(sessionFeed.published).toEqual([
        {
          runId: 'id-1',
          event: { kind: 'entry', entry: { kind: 'prompt', id: 'p2#0', text: 'implement #12' } },
        },
        { runId: 'id-1', event: { kind: 'text-delta', opensBlock: true, text: 'Hel' } },
        { runId: 'id-1', event: { kind: 'entry', entry } },
      ]);
      expect(runTranscripts.sessionEntryReads).toHaveLength(1);
    });

    it('should still publish the entry and log the failure when the prompt read fails', async () => {
      const { service, agentSessions, finishCalls, runTranscripts, sessionFeed, logger } =
        buildStartSubject();
      runTranscripts.sessionEntriesFailure = new Error('disk failure');
      await service.start(startRequest);
      const entry = { kind: 'text', id: 'u#0', text: 'Hello' } as const;

      agentSessions.push('id-2', { kind: 'entry', entry });
      agentSessions.push('id-2', { kind: 'completed' });

      await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
      expect(sessionFeed.published).toEqual([{ runId: 'id-1', event: { kind: 'entry', entry } }]);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('disk failure'));
    });

    describe('command labels', () => {
      const bashCall = (input: unknown) =>
        ({ kind: 'tool-call', id: 'u#0', toolUseId: 't1', name: 'Bash', input }) as const;

      async function runWith(commandLabeler: FakeCommandLabeler, input: unknown) {
        const subject = buildService({ commandLabeler });
        await subject.service.start(startRequest);
        subject.agentSessions.push('id-2', { kind: 'entry', entry: bashCall(input) });
        subject.agentSessions.push('id-2', { kind: 'completed' });
        await vi.waitFor(() => expect(subject.finishCalls).toHaveLength(1));
        return subject;
      }

      it('should label the command once when the session emits a Bash call without description', async () => {
        const commandLabeler = new FakeCommandLabeler('Runs the tests.');

        await runWith(commandLabeler, { command: 'npm test' });

        expect(commandLabeler.commands).toEqual(['npm test']);
      });

      it('should not label the command when the Bash call has a description', async () => {
        const commandLabeler = new FakeCommandLabeler('x');

        await runWith(commandLabeler, { command: 'npm test', description: 'Run tests' });

        expect(commandLabeler.commands).toEqual([]);
      });

      it('should finish the run when the labeler rejects', async () => {
        const commandLabeler = new FakeCommandLabeler(new Error('haiku down'));

        const { finishCalls, logger } = await runWith(commandLabeler, { command: 'npm test' });

        expect(finishCalls).toEqual([{ runId: 'id-1', ending: { kind: 'finished' } }]);
        await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
      });
    });

    it('should end the feed when the session completes', async () => {
      const { service, agentSessions, sessionFeed } = buildStartSubject();
      await service.start(startRequest);

      agentSessions.push('id-2', { kind: 'completed' });
      agentSessions.close('id-2');

      await vi.waitFor(() => expect(sessionFeed.endedRunIds).toEqual(['id-1']));
      expect(sessionFeed.endedRunIds).toEqual(['id-1']);
    });

    it('should end the feed when the session throws', async () => {
      const { service, agentSessions, sessionFeed } = buildStartSubject();
      await service.start(startRequest);

      agentSessions.fail('id-2', new Error('boom'));

      await vi.waitFor(() => expect(sessionFeed.endedRunIds).toEqual(['id-1']));
      expect(sessionFeed.endedRunIds).toEqual(['id-1']);
    });

    it('should end the run as finished when the session completes', async () => {
      const { service, agentSessions, finishCalls } = buildStartSubject();
      await service.start(startRequest);

      agentSessions.push('id-2', { kind: 'completed' });

      await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
      expect(finishCalls).toEqual([{ runId: 'id-1', ending: { kind: 'finished' } }]);
    });

    describe('usage windows', () => {
      const refusedAt = '2026-10-19T10:00:00.000Z';

      function observed(events: FakeEventPublisher) {
        return events.emittedEvents
          .filter(({ name }) => name === 'usage.window-observed')
          .map(({ payload }) => payload);
      }

      function fixtureEvents(name: string) {
        return readFileSync(
          new URL(`../../testing/fixtures/sessions/${name}`, import.meta.url),
          'utf8',
        )
          .trim()
          .split('\n')
          .flatMap((line) => mapSdkMessage(JSON.parse(line) as SDKMessage));
      }

      function refusal(window: { resetsAt?: number; windowResetsAt?: number }): SessionEvent {
        return mapSdkMessage({
          type: 'rate_limit_event',
          rate_limit_info: {
            status: 'rejected',
            overageStatus: 'rejected',
            rateLimitType: 'five_hour',
            ...(window.resetsAt === undefined ? {} : { resetsAt: window.resetsAt }),
            ...(window.windowResetsAt === undefined
              ? {}
              : {
                  unifiedWindows: {
                    five_hour: { utilization: 1, resetsAt: window.windowResetsAt },
                  },
                }),
          },
        } as unknown as SDKMessage)[0] as SessionEvent;
      }

      it('should publish the window reading and keep the run running when the window is allowed', async () => {
        const { service, agentSessions, events, finishCalls } = buildService({ now: refusedAt });
        await service.start(startRequest);

        agentSessions.push('id-2', fixtureEvents('handbacks-live.jsonl')[0] as SessionEvent);

        await vi.waitFor(() => expect(observed(events)).toHaveLength(1));
        expect(observed(events)).toEqual([
          {
            observedAt: refusedAt,
            fiveHour: { utilizationPercent: 6, resetsAt: '2026-10-17T16:00:00.000Z' },
            sevenDay: { utilizationPercent: 35, resetsAt: '2026-10-18T09:00:00.000Z' },
            refusedUntil: null,
          },
        ]);
        expect(finishCalls).toEqual([]);
      });

      it('should end the run as usage-limit naming the window and time when calls are refused', async () => {
        const { service, agentSessions, events, finishCalls } = buildService({ now: refusedAt });
        await service.start(startRequest);

        for (const event of fixtureEvents('limit-hit-live.jsonl')) {
          agentSessions.push('id-2', event);
        }

        await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
        expect(observed(events)).toMatchObject([{ refusedUntil: '2026-10-17T16:00:00.000Z' }]);
        expect(finishCalls).toEqual([
          {
            runId: 'id-1',
            ending: {
              kind: 'usage-limit',
              reason: 'The five_hour usage limit was reached (resets at 2026-10-17T16:00:00.000Z)',
            },
          },
        ]);
      });

      it('should refuse until the window reset when the refusal has no resetsAt', async () => {
        const { service, agentSessions, events, finishCalls } = buildService({ now: refusedAt });
        await service.start(startRequest);

        agentSessions.push('id-2', refusal({ windowResetsAt: 1792252800 }));

        await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
        expect(observed(events)).toMatchObject([{ refusedUntil: '2026-10-17T16:00:00.000Z' }]);
        expect(finishCalls[0]?.ending.kind).toBe('usage-limit');
      });

      it('should refuse for one hour when no reset time is known', async () => {
        const { service, agentSessions, events, finishCalls } = buildService({ now: refusedAt });
        await service.start(startRequest);

        agentSessions.push('id-2', refusal({}));

        await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
        expect(observed(events)).toMatchObject([{ refusedUntil: '2026-10-19T11:00:00.000Z' }]);
        expect(finishCalls[0]?.ending).toEqual({
          kind: 'usage-limit',
          reason: 'The five_hour usage limit was reached (resets at 2026-10-19T11:00:00.000Z)',
        });
      });

      it('should end the run as finished when overage is allowed after a rejected event', async () => {
        const { service, agentSessions, events, finishCalls } = buildService({ now: refusedAt });
        await service.start(startRequest);

        agentSessions.push(
          'id-2',
          mapSdkMessage({
            type: 'rate_limit_event',
            rate_limit_info: { status: 'rejected', overageStatus: 'allowed' },
          } as unknown as SDKMessage)[0] as SessionEvent,
        );
        agentSessions.push('id-2', { kind: 'completed' });

        await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
        expect(observed(events)).toMatchObject([{ refusedUntil: null }]);
        expect(finishCalls[0]?.ending).toEqual({ kind: 'finished' });
      });
    });

    it('should end the run as crashed with the reason when the session reports a crash', async () => {
      const { service, agentSessions, finishCalls } = buildStartSubject();
      await service.start(startRequest);

      agentSessions.push('id-2', { kind: 'crashed', reason: 'Login expired' });

      await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
      expect(finishCalls[0]).toEqual({
        runId: 'id-1',
        ending: { kind: 'crashed', reason: 'Login expired' },
      });
    });

    it('should end the run as crashed with the error message when the session stream throws', async () => {
      const { service, agentSessions, finishCalls } = buildStartSubject();
      await service.start(startRequest);

      agentSessions.fail('id-2', new Error('spawn claude ENOENT'));

      await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
      expect(finishCalls[0]).toEqual({
        runId: 'id-1',
        ending: { kind: 'crashed', reason: 'spawn claude ENOENT' },
      });
    });

    it('should log the failure instead of leaving a rejection unhandled when recording the ending throws', async () => {
      const { service, agentSessions, logger } = buildService({
        finish: async () => {
          throw new Error('subscriber failed');
        },
      });
      await service.start(startRequest);

      agentSessions.push('id-2', { kind: 'completed' });

      await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('subscriber failed'));
    });

    it('should hand the session every tool with the run context bound when the run starts', async () => {
      const { service, agentSessions, executedContexts, finishCalls, runRepository } =
        buildStartSubject();
      await service.start(startRequest);
      const sessionTools = agentSessions.startedSpecs[0]?.tools ?? [];

      const probeResult = await sessionTools
        .find((tool) => tool.name === 'aisf_probe')
        ?.execute({ value: 'x' });

      expect(sessionTools.map((tool) => tool.name)).toEqual(['aisf_probe', 'aisf_ending']);
      expect(probeResult).toBe('probed');
      expect(executedContexts).toEqual([
        {
          runId: 'id-1',
          projectId: 'moritz/aisf',
          ticketNumber: 137,
          worktreePath: '/worktrees/aisf/137',
        },
      ]);
      expect(runRepository.runs.get('id-1')?.ending).toBeUndefined();
      expect(finishCalls).toEqual([]);
    });

    it('should end the run with the tool ending when a tool returns an ending', async () => {
      const { service, agentSessions, finishCalls } = buildStartSubject();
      await service.start(startRequest);
      const sessionTools = agentSessions.startedSpecs[0]?.tools ?? [];

      const endingResult = await sessionTools
        .find((tool) => tool.name === 'aisf_ending')
        ?.execute({});

      expect(endingResult).toBe('ended');
      expect(finishCalls).toEqual([
        { runId: 'id-1', ending: { kind: 'parked', blockerNumber: 42 } },
      ]);
    });

    it('should emit run.started after the run is stored when the run starts', async () => {
      const { service, events, runRepository } = buildStartSubject();
      let activeAtEmit: string[] = [];
      const emitted: string[] = [];
      events.emit = (name) => {
        emitted.push(name);
        if (name === 'run.started') {
          activeAtEmit = [...runRepository.runs.values()]
            .filter((run) => run.state === 'running')
            .map((run) => run.id);
        }
      };

      await service.start(startRequest);

      expect(emitted).toEqual(['run.started']);
      expect(activeAtEmit).toEqual(['id-1']);
    });

    it('should emit run.started with the run id, project and ticket when the run starts', async () => {
      const { service, events } = buildStartSubject();

      await service.start(startRequest);

      expect(events.emittedEvents).toEqual([
        {
          name: 'run.started',
          payload: { runId: 'id-1', projectId: 'moritz/aisf', ticketNumber: 137 },
        },
      ]);
    });

    it('should emit only run.started and still feed the entry when the session yields assistant text', async () => {
      const { service, agentSessions, events, sessionFeed, finishCalls } = buildStartSubject();
      await service.start(startRequest);

      agentSessions.push('id-2', {
        kind: 'entry',
        entry: { kind: 'text', id: 'e1', text: 'Reading the ticket now.' },
      });
      agentSessions.push('id-2', { kind: 'completed' });

      await vi.waitFor(() => expect(finishCalls).toHaveLength(1));
      expect(events.emittedEvents.map(({ name }) => name)).toEqual(['run.started']);
      expect(sessionFeed.published.some(({ event }) => event.kind === 'entry')).toBe(true);
    });
  });

  describe('resume', () => {
    const allow: RunAnswer = { kind: 'permission', decision: 'allow' };
    const deny: RunAnswer = { kind: 'permission', decision: 'deny' };
    const checkpointEnding: RunEnding = { kind: 'checkpoint', request: 'Check the page' };
    const permissionNeeded: RunEnding = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'git push' },
    };

    function buildResumeSubject() {
      const subject = buildService({ now: '2026-09-29T11:00:00.000Z' });

      async function insertEndedRun(overrides: Partial<Run> = {}): Promise<void> {
        await subject.runRepository.insert(
          buildRun({
            id: 'run-1',
            state: 'ended',
            ending: permissionNeeded,
            endedAt: '2026-09-29T10:05:00.000Z',
            ...overrides,
          }),
        );
      }

      return { ...subject, insertEndedRun };
    }

    it('should insert a running run for the same ticket, worktree and session when the run needs permission', async () => {
      const { service, runRepository, insertEndedRun } = buildResumeSubject();
      await insertEndedRun();

      const resumed = await service.resume('run-1', allow);

      expect(resumed).toEqual({
        id: 'id-1',
        projectId: 'moritz/aisf',
        ticketNumber: 137,
        stage: 'implement',
        mode: 'afk',
        sessionId: 'session-1',
        worktreePath: '/worktrees/aisf/137',
        branchName: 'aisf/137-runner',
        state: 'running',
        startedAt: '2026-09-29T11:00:00.000Z',
      });
      expect(runRepository.runs.get('id-1')).toEqual(resumed);
    });

    it('should resume the session with the call allowed once when the decision is allow', async () => {
      const { service, agentSessions, insertEndedRun } = buildResumeSubject();
      await insertEndedRun();

      await service.resume('run-1', allow);

      expect(agentSessions.startedSpecs).toEqual([]);
      expect(agentSessions.resumedSpecs).toHaveLength(1);
      expect(agentSessions.resumedSpecs[0]).toMatchObject({
        sessionId: 'session-1',
        worktreePath: '/worktrees/aisf/137',
        model: 'sonnet',
        allowedCall: { toolName: 'Bash', toolInput: { command: 'git push' } },
      });
      expect(agentSessions.resumedSpecs[0]?.prompt).toContain('allowed');
    });

    it('should resume the session without an allowed call and tell it the call was refused when the decision is deny', async () => {
      const { service, agentSessions, insertEndedRun } = buildResumeSubject();
      await insertEndedRun();

      await service.resume('run-1', deny);

      expect(agentSessions.resumedSpecs).toHaveLength(1);
      expect(agentSessions.resumedSpecs[0]?.prompt).toContain('refused');
      expect(agentSessions.resumedSpecs[0]).not.toHaveProperty('allowedCall');
    });

    it('should resume a settled run when its ending was permission-needed', async () => {
      const { service, agentSessions, insertEndedRun } = buildResumeSubject();
      await insertEndedRun({ state: 'settled' });

      await service.resume('run-1', allow);

      expect(agentSessions.resumedSpecs).toHaveLength(1);
    });

    it.each<[string, (subject: ReturnType<typeof buildResumeSubject>) => Promise<void>]>([
      ['the run is unknown', async () => undefined],
      [
        'the run ended another way',
        ({ insertEndedRun }) => insertEndedRun({ ending: { kind: 'crashed', reason: 'boom' } }),
      ],
      [
        'the run is still running',
        ({ runRepository }) => runRepository.insert(buildRun({ id: 'run-1' })),
      ],
      [
        'a newer run exists for the ticket',
        async ({ insertEndedRun, runRepository }) => {
          await insertEndedRun();
          await runRepository.insert(
            buildRun({
              id: 'run-2',
              state: 'ended',
              ending: { kind: 'finished' },
              startedAt: '2026-09-29T10:30:00.000Z',
            }),
          );
        },
      ],
    ])(
      'should throw RunNotResumableError and change nothing when %s',
      async (_situation, arrange) => {
        const subject = buildResumeSubject();
        await arrange(subject);
        const runCountBefore = subject.runRepository.runs.size;

        await expect(subject.service.resume('run-1', allow)).rejects.toThrow(RunNotResumableError);

        expect(subject.runRepository.runs.size).toBe(runCountBefore);
        expect(subject.agentSessions.resumedSpecs).toEqual([]);
      },
    );

    it('should throw RunAlreadyActiveError and resume nothing when the ticket already has a running run', async () => {
      const { service, runRepository, agentSessions, insertEndedRun } = buildResumeSubject();
      await insertEndedRun();
      await runRepository.insert(buildRun({ id: 'other-run' }));

      await expect(service.resume('run-1', allow)).rejects.toThrow(RunAlreadyActiveError);

      expect(agentSessions.resumedSpecs).toEqual([]);
    });

    it('should record the ending on the new run when the session carries on', async () => {
      const { service, agentSessions, finishCalls, runRepository, insertEndedRun } =
        buildResumeSubject();
      await insertEndedRun();
      await service.resume('run-1', allow);

      agentSessions.push('session-1', { kind: 'completed' });
      await vi.waitFor(() => {
        expect(finishCalls).toEqual([{ runId: 'id-1', ending: { kind: 'finished' } }]);
      });

      expect(runRepository.runs.get('run-1')?.ending).toEqual(permissionNeeded);
    });

    describe('with a checkpoint answer', () => {
      const answer: RunAnswer = { kind: 'checkpoint', text: 'Looks right' };

      it.each(['ended', 'settled'] as const)(
        'should resume the same session with the checkpoint prompt and no allowed call when the run is %s',
        async (state) => {
          const { service, runRepository, agentSessions, insertEndedRun } = buildResumeSubject();
          await insertEndedRun({ state, ending: checkpointEnding });

          const resumed = await service.resume('run-1', answer);

          expect(resumed).toMatchObject({
            id: 'id-1',
            state: 'running',
            sessionId: 'session-1',
            worktreePath: '/worktrees/aisf/137',
            branchName: 'aisf/137-runner',
          });
          expect(runRepository.runs.get('id-1')).toEqual(resumed);
          expect(agentSessions.resumedSpecs).toHaveLength(1);
          expect(agentSessions.resumedSpecs[0]?.prompt).toBe(
            buildCheckpointResumePrompt(
              137,
              'Check the page',
              'Looks right',
              'aisf:implement-ticket',
            ),
          );
          expect(agentSessions.resumedSpecs[0]).not.toHaveProperty('allowedCall');
        },
      );

      it('should tell a spike run to carry on with aisf:spike when it resumes after a checkpoint', async () => {
        const { service, agentSessions, insertEndedRun } = buildResumeSubject();
        await insertEndedRun({ stage: 'spike', ending: checkpointEnding });

        await service.resume('run-1', answer);

        expect(agentSessions.resumedSpecs[0]?.prompt).toContain(
          'Carry on with aisf:spike for #137 from its human checkpoint.',
        );
      });

      it.each<[string, Partial<Run>]>([
        ['a permission-needed ending', { ending: permissionNeeded }],
        ['a finished ending', { ending: { kind: 'finished' } }],
      ])('should throw RunNotResumableError when the run has %s', async (_name, overrides) => {
        const { service, runRepository, agentSessions, insertEndedRun } = buildResumeSubject();
        await insertEndedRun(overrides);

        await expect(service.resume('run-1', answer)).rejects.toThrow(RunNotResumableError);

        expect(runRepository.runs.size).toBe(1);
        expect(agentSessions.resumedSpecs).toEqual([]);
      });

      it('should throw RunNotResumableError when the run is unknown', async () => {
        const { service } = buildResumeSubject();

        await expect(service.resume('missing-run', answer)).rejects.toThrow(RunNotResumableError);
      });

      it('should throw RunNotResumableError when a newer run exists', async () => {
        const { service, runRepository, agentSessions, insertEndedRun } = buildResumeSubject();
        await insertEndedRun({ ending: checkpointEnding });
        await runRepository.insert(
          buildRun({
            id: 'run-2',
            state: 'ended',
            ending: { kind: 'finished' },
            startedAt: '2026-09-29T10:30:00.000Z',
          }),
        );

        await expect(service.resume('run-1', answer)).rejects.toThrow(RunNotResumableError);
        expect(agentSessions.resumedSpecs).toEqual([]);
      });

      it('should throw RunAlreadyActiveError when another run is running', async () => {
        const { service, runRepository, agentSessions, insertEndedRun } = buildResumeSubject();
        await insertEndedRun({ ending: checkpointEnding });
        await runRepository.insert(buildRun({ id: 'other-run' }));

        await expect(service.resume('run-1', answer)).rejects.toThrow(RunAlreadyActiveError);
        expect(agentSessions.resumedSpecs).toEqual([]);
      });
    });

    it.each<[string, RunEnding]>([['a checkpoint run', checkpointEnding]])(
      'should throw RunNotResumableError when a permission answer meets %s',
      async (_name, ending) => {
        const { service, runRepository, agentSessions, insertEndedRun } = buildResumeSubject();
        await insertEndedRun({ ending });

        await expect(service.resume('run-1', allow)).rejects.toThrow(RunNotResumableError);
        expect(runRepository.runs.size).toBe(1);
        expect(agentSessions.resumedSpecs).toEqual([]);
      },
    );

    it('should emit run.started for the new run when a run is resumed', async () => {
      const { service, events, insertEndedRun } = buildResumeSubject();
      await insertEndedRun();

      await service.resume('run-1', allow);

      expect(events.emittedEvents).toEqual([
        {
          name: 'run.started',
          payload: { runId: 'id-1', projectId: 'moritz/aisf', ticketNumber: 137 },
        },
      ]);
    });
  });

  describe('resumePaused', () => {
    const usageLimit: RunEnding = { kind: 'usage-limit', reason: 'limit reached' };

    async function buildPausedSubject(overrides: Partial<Run> = {}) {
      const subject = buildService({ now: '2026-09-29T11:00:00.000Z' });
      await subject.runRepository.insert(
        buildRun({
          id: 'run-1',
          state: 'ended',
          ending: usageLimit,
          endedAt: '2026-09-29T10:05:00.000Z',
          ...overrides,
        }),
      );
      return subject;
    }

    it('should insert a running run with the same session, worktree and branch and emit run.started when the run ended usage-limit', async () => {
      const { service, runRepository, events } = await buildPausedSubject();

      const resumed = await service.resumePaused('run-1');

      expect(resumed).toEqual({
        id: 'id-1',
        projectId: 'moritz/aisf',
        ticketNumber: 137,
        stage: 'implement',
        mode: 'afk',
        sessionId: 'session-1',
        worktreePath: '/worktrees/aisf/137',
        branchName: 'aisf/137-runner',
        state: 'running',
        startedAt: '2026-09-29T11:00:00.000Z',
      });
      expect(runRepository.runs.get('id-1')).toEqual(resumed);
      expect(events.emittedEvents.map(({ name }) => name)).toEqual(['run.started']);
    });

    it('should resume the session with the prompt continue when the run ended usage-limit', async () => {
      const { service, agentSessions } = await buildPausedSubject();

      await service.resumePaused('run-1');

      expect(agentSessions.startedSpecs).toEqual([]);
      expect(agentSessions.resumedSpecs).toHaveLength(1);
      expect(agentSessions.resumedSpecs[0]).toMatchObject({
        sessionId: 'session-1',
        worktreePath: '/worktrees/aisf/137',
        prompt: 'continue',
      });
    });

    it('should throw RunNotResumableError and insert nothing when the run did not end usage-limit', async () => {
      const { service, runRepository } = await buildPausedSubject({ ending: { kind: 'finished' } });

      await expect(service.resumePaused('run-1')).rejects.toThrow(RunNotResumableError);

      expect(runRepository.runs.size).toBe(1);
    });

    it('should throw RunNotResumableError and insert nothing when the run is unknown', async () => {
      const { service, runRepository } = buildService();

      await expect(service.resumePaused('r9')).rejects.toThrow(RunNotResumableError);

      expect(runRepository.runs.size).toBe(0);
    });

    it('should throw RunNotResumableError and insert nothing when the ticket has a newer run', async () => {
      const { service, runRepository } = await buildPausedSubject();
      await runRepository.insert(
        buildRun({
          id: 'run-2',
          state: 'ended',
          ending: { kind: 'finished' },
          startedAt: '2026-09-29T10:30:00.000Z',
        }),
      );

      await expect(service.resumePaused('run-1')).rejects.toThrow(RunNotResumableError);

      expect(runRepository.runs.size).toBe(2);
    });

    it('should throw RunAlreadyActiveError when the ticket already has a running run', async () => {
      const { service, runRepository } = await buildPausedSubject();
      await runRepository.insert(
        buildRun({ id: 'other-run', startedAt: '2026-09-29T10:00:00.000Z' }),
      );

      await expect(service.resumePaused('run-1')).rejects.toThrow(RunAlreadyActiveError);
    });

    it('should end the new run as crashed with the failure when the resumed session fails', async () => {
      const { service, agentSessions, finishCalls } = await buildPausedSubject();
      await service.resumePaused('run-1');

      agentSessions.fail('session-1', new Error('resume failed'));

      await vi.waitFor(() =>
        expect(finishCalls).toEqual([
          { runId: 'id-1', ending: { kind: 'crashed', reason: 'resume failed' } },
        ]),
      );
    });
  });

  describe('launchSession', () => {
    describe('session launch', () => {
      it('should start the session with the run session, worktree, prompt and stage model when the launch is a start', () => {
        const { service, agentSessions } = buildService();

        service.launchSession(buildRun(), { kind: 'start', prompt: '/aisf:implement-ticket 137' });

        expect(agentSessions.resumedSpecs).toEqual([]);
        expect(agentSessions.startedSpecs).toHaveLength(1);
        expect(agentSessions.startedSpecs[0]).toMatchObject({
          sessionId: 'session-1',
          worktreePath: '/worktrees/aisf/137',
          prompt: '/aisf:implement-ticket 137',
          model: 'sonnet',
        });
      });

      it('should resume the session with the allowed call when the launch is a resume with one', () => {
        const { service, agentSessions } = buildService();
        const allowedCall = { toolName: 'Bash', toolInput: { command: 'git push' } };

        service.launchSession(buildRun(), { kind: 'resume', prompt: 'carry on', allowedCall });

        expect(agentSessions.startedSpecs).toEqual([]);
        expect(agentSessions.resumedSpecs[0]).toMatchObject({
          sessionId: 'session-1',
          prompt: 'carry on',
          allowedCall,
        });
      });

      it('should resume the session without an allowed call when the launch is a resume without one', () => {
        const { service, agentSessions } = buildService();

        service.launchSession(buildRun(), { kind: 'resume', prompt: 'carry on' });

        expect(agentSessions.resumedSpecs).toHaveLength(1);
        expect(agentSessions.resumedSpecs[0]).not.toHaveProperty('allowedCall');
      });
    });

    describe('bound tools', () => {
      function buildTool(result: Awaited<ReturnType<AgentTool['execute']>>) {
        const executions: unknown[] = [];
        const tool: AgentTool = {
          name: 'aisf_example',
          description: 'Example',
          inputShape: {},
          execute: async (input) => {
            executions.push(input);
            return result;
          },
        };
        return { tool, executions };
      }

      async function callBoundTool(subject: ReturnType<typeof buildService>, run = buildRun()) {
        await subject.runRepository.insert(run);
        subject.service.launchSession(run, { kind: 'start', prompt: 'go' });
        const [boundTool] = subject.agentSessions.startedSpecs[0]?.tools ?? [];
        return boundTool?.execute({ any: 'input' });
      }

      it('should return the tool text and finish the run when the result carries an ending', async () => {
        const { tool } = buildTool({ text: 'done', ending: { kind: 'finished' } });
        const subject = buildService({ tools: [tool] });

        expect(await callBoundTool(subject)).toBe('done');
        expect(subject.finishCalls).toEqual([{ runId: 'run-1', ending: { kind: 'finished' } }]);
      });

      it('should hold the run for the wait and return its answer when the result is a wait', async () => {
        const { tool } = buildTool({ wait: { kind: 'checkpoint', request: 'Check' } });
        const subject = buildService({ tools: [tool] });
        const result = callBoundTool(subject);

        await vi.waitFor(() => expect(subject.runAnswerWaits.isWaiting('run-1')).toBe(true));
        expect(subject.runRepository.runs.get('run-1')?.waitingFor).toEqual({
          kind: 'checkpoint',
          request: 'Check',
        });
        subject.runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'the answer' });

        expect(await result).toBe('the answer');
        expect(subject.finishCalls).toEqual([]);
      });

      it('should return the unanswered message when the wait is unanswered', async () => {
        const { tool } = buildTool({ wait: { kind: 'checkpoint', request: 'Check' } });
        const subject = buildService({ tools: [tool] });
        const result = callBoundTool(subject);

        await vi.waitFor(() => expect(subject.runAnswerWaits.isWaiting('run-1')).toBe(true));
        subject.runAnswerWaits.cancel('run-1');

        expect(await result).toBe('The run has ended. End your turn.');
      });

      it('should refuse and run nothing when the run is no longer running', async () => {
        const { tool, executions } = buildTool({ text: 'done', ending: { kind: 'finished' } });
        const subject = buildService({ tools: [tool] });

        const text = await callBoundTool(
          subject,
          buildRun({ state: 'ended', ending: { kind: 'stopped' } }),
        );

        expect(text).toContain('has ended');
        expect(executions).toEqual([]);
        expect(subject.finishCalls).toEqual([]);
        expect(runningEvents(subject.events)).toEqual([]);
      });
    });

    describe('bound permission decision', () => {
      const dateCall = { toolName: 'Bash', toolInput: { command: 'date' } };
      const refusal = 'A human refused this tool call. Do not retry it; carry on without it.';

      async function launch(
        subject: ReturnType<typeof buildService>,
        kind: 'start' | 'resume' = 'start',
        run: Run = buildRun(),
      ) {
        await subject.runRepository.insert(run);
        subject.service.launchSession(run, { kind, prompt: 'go' });
        const spec = (
          kind === 'start' ? subject.agentSessions.startedSpecs : subject.agentSessions.resumedSpecs
        ).at(-1);
        if (spec === undefined) {
          throw new Error('no spec');
        }
        return spec;
      }

      function waitsOf(subject: ReturnType<typeof buildService>): unknown[] {
        return runningEvents(subject.events).map(
          ({ payload }) => (payload as { wait: RunWait }).wait,
        );
      }

      async function untilWaiting(subject: ReturnType<typeof buildService>, runId = 'run-1') {
        await vi.waitFor(() => expect(subject.runAnswerWaits.isWaiting(runId)).toBe(true));
      }

      it('should wait on the permission and return allow when the answer is allow', async () => {
        const subject = buildService();
        const spec = await launch(subject);

        const verdict = spec.decidePermission(dateCall);
        await untilWaiting(subject);
        subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'allow' });

        expect(await verdict).toEqual({ kind: 'allow' });
        expect(waitsOf(subject)).toEqual([{ kind: 'permission-needed', ...dateCall }]);
      });

      it('should pass the reason into the permission wait when the request has one', async () => {
        const subject = buildService();
        const spec = await launch(subject);
        const request = { ...dateCall, reason: 'Posting to GitHub is hard-denied' };

        const verdict = spec.decidePermission(request);
        await untilWaiting(subject);
        subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'allow' });
        await verdict;

        expect(waitsOf(subject)).toEqual([{ kind: 'permission-needed', ...request }]);
      });

      it('should return the same verdict for a resume launch when the answer is allow', async () => {
        const subject = buildService();
        const spec = await launch(subject, 'resume');

        const verdict = spec.decidePermission(dateCall);
        await untilWaiting(subject);
        subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'allow' });

        expect(await verdict).toEqual({ kind: 'allow' });
      });

      it('should return a refusing deny when the answer is deny', async () => {
        const subject = buildService();
        const spec = await launch(subject);

        const verdict = spec.decidePermission(dateCall);
        await untilWaiting(subject);
        subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'deny' });

        expect(await verdict).toEqual({ kind: 'deny', message: refusal });
      });

      it('should return a deny with the wait message when the wait is unanswered', async () => {
        const subject = buildService();
        const spec = await launch(subject);

        const verdict = spec.decidePermission(dateCall);
        await untilWaiting(subject);
        subject.runAnswerWaits.cancel('run-1');

        expect(await verdict).toEqual({
          kind: 'deny',
          message: 'The run has ended. End your turn.',
        });
      });

      it('should start the second wait only after the first settles when two calls are decided together', async () => {
        const subject = buildService();
        const spec = await launch(subject);
        const unameCall = { toolName: 'Bash', toolInput: { command: 'uname' } };

        const dateVerdict = spec.decidePermission(dateCall);
        const unameVerdict = spec.decidePermission(unameCall);
        await untilWaiting(subject);
        await Promise.resolve();

        expect(waitsOf(subject)).toEqual([{ kind: 'permission-needed', ...dateCall }]);
        subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'allow' });
        expect(await dateVerdict).toEqual({ kind: 'allow' });
        await vi.waitFor(() => expect(waitsOf(subject)).toHaveLength(2));
        expect(waitsOf(subject)[1]).toEqual({ kind: 'permission-needed', ...unameCall });
        await untilWaiting(subject);
        subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'deny' });
        expect(await unameVerdict).toEqual({ kind: 'deny', message: refusal });
      });

      it('should start the queued wait when the earlier wait ends unanswered', async () => {
        const subject = buildService();
        const spec = await launch(subject);
        // The real run end clears the wait; the fake end does not, so clear it when the queued call records its wait.
        const baseRecordWait = subject.runRepository.recordWait.bind(subject.runRepository);
        subject.runRepository.recordWait = async (runId, wait, waitingSince) => {
          await subject.runRepository.clearWait(runId);
          return baseRecordWait(runId, wait, waitingSince);
        };

        const earlierVerdict = spec.decidePermission(dateCall);
        const queuedVerdict = spec.decidePermission(dateCall);
        await untilWaiting(subject);
        subject.runAnswerWaits.cancel('run-1');

        expect(await earlierVerdict).toEqual({
          kind: 'deny',
          message: 'The run has ended. End your turn.',
        });
        await untilWaiting(subject);
        subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'allow' });
        expect(await queuedVerdict).toEqual({ kind: 'allow' });
      });

      it('should keep one queue per launch when two launches decide permissions', async () => {
        const subject = buildService();
        const startSpec = await launch(subject);
        const resumeSpec = await launch(
          subject,
          'resume',
          buildRun({ id: 'run-2', ticketNumber: 138 }),
        );

        void startSpec.decidePermission(dateCall);
        void resumeSpec.decidePermission(dateCall);

        await vi.waitFor(() => expect(waitsOf(subject)).toHaveLength(2));
      });
    });
  });

  describe('waitForAnswer', () => {
    function buildWaitSubject() {
      return buildService({ now: '2026-09-29T10:05:00.000Z' });
    }

    async function insertRun(subject: ReturnType<typeof buildService>): Promise<void> {
      await subject.runRepository.insert(buildRun());
    }

    it('should hold, record the wait and emit run.waiting when the run has no wait', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const wait = { kind: 'checkpoint', request: 'Check the page' } as const;

      let returned = false;
      const result = subject.service.waitForAnswer(buildRun(), wait).then((outcome) => {
        returned = true;
        return outcome;
      });
      await Promise.resolve();

      expect(returned).toBe(false);
      expect(subject.runRepository.runs.get('run-1')).toMatchObject({
        state: 'running',
        waitingFor: wait,
        waitingSince: '2026-09-29T10:05:00.000Z',
      });
      expect(subject.runAnswerWaits.windowsByRunId.get('run-1')).toBe(3_600_000);
      expect(subject.events.emittedEvents).toEqual([
        {
          name: 'run.waiting',
          payload: {
            runId: 'run-1',
            projectId: 'moritz/aisf',
            ticketNumber: 137,
            stage: 'implement',
            wait,
          },
        },
      ]);
      expect(subject.finishCalls).toEqual([]);
      subject.runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'ok' });
      await result;
    });

    it('should return the answer text and clear the wait when an answer is delivered', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const result = subject.service.waitForAnswer(buildRun(), {
        kind: 'checkpoint',
        request: 'Check',
      });
      await Promise.resolve();

      subject.runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'Looks good' });

      expect(await result).toEqual({
        kind: 'answered',
        answer: { kind: 'checkpoint', text: 'Looks good' },
      });
      const run = subject.runRepository.runs.get('run-1');
      expect(run?.state).toBe('running');
      expect(run).not.toHaveProperty('waitingFor');
      expect(run).not.toHaveProperty('waitingSince');
    });

    it('should refuse at once and change nothing when the run already waits', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const first = subject.service.waitForAnswer(buildRun(), {
        kind: 'checkpoint',
        request: 'Check the page',
      });
      await Promise.resolve();

      const outcome = await subject.service.waitForAnswer(buildRun(), {
        kind: 'checkpoint',
        request: 'Second',
      });

      expect(outcome).toEqual({
        kind: 'unanswered',
        message:
          'This run is already waiting for an answer. Do not call this tool again: end your turn.',
      });
      expect(subject.events.emittedEvents).toHaveLength(1);
      expect(subject.runRepository.runs.get('run-1')?.waitingFor).toEqual({
        kind: 'checkpoint',
        request: 'Check the page',
      });
      subject.runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'ok' });
      await first;
    });

    it('should end the run with the wait when the window passes', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const result = subject.service.waitForAnswer(buildRun(), {
        kind: 'checkpoint',
        request: 'Check the page',
      });
      await Promise.resolve();

      subject.runAnswerWaits.expire('run-1');

      expect(await result).toEqual({
        kind: 'unanswered',
        message:
          'The answer window has passed. End your turn: the app resumes this session when the human answers.',
      });

      expect(subject.finishCalls).toEqual([
        { runId: 'run-1', ending: { kind: 'checkpoint', request: 'Check the page' } },
      ]);
    });

    it('should tell the session to end its turn when the wait is cancelled', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const result = subject.service.waitForAnswer(buildRun(), {
        kind: 'checkpoint',
        request: 'Check',
      });
      await Promise.resolve();

      subject.runAnswerWaits.cancel('run-1');

      expect(await result).toEqual({
        kind: 'unanswered',
        message: 'The run has ended. End your turn.',
      });
      expect(subject.finishCalls).toEqual([]);
    });

    it('should carry the artifactId on the run and the event when the wait has one', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const wait = { kind: 'checkpoint', request: 'Check', artifactId: 'confirm-plan' } as const;
      const result = subject.service.waitForAnswer(buildRun(), wait);
      await Promise.resolve();

      expect(subject.runRepository.runs.get('run-1')?.waitingFor).toEqual(wait);
      expect(subject.events.emittedEvents).toMatchObject([{ payload: { wait } }]);
      subject.runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'ok' });
      await result;
    });

    it('should hold a permission wait and end the run with it when the window passes', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const wait = {
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'ls' },
      } as const;
      const result = subject.service.waitForAnswer(buildRun(), wait);
      await Promise.resolve();

      expect(subject.runRepository.runs.get('run-1')?.waitingFor).toEqual(wait);
      expect(subject.events.emittedEvents).toMatchObject([
        { name: 'run.waiting', payload: { wait } },
      ]);
      subject.runAnswerWaits.expire('run-1');
      await result;

      expect(subject.finishCalls).toEqual([{ runId: 'run-1', ending: wait }]);
    });

    it('should resolve answered with the permission answer when one is delivered', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const result = subject.service.waitForAnswer(buildRun(), {
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'ls' },
      });
      await Promise.resolve();

      subject.runAnswerWaits.deliver('run-1', { kind: 'permission', decision: 'deny' });

      expect(await result).toEqual({
        kind: 'answered',
        answer: { kind: 'permission', decision: 'deny' },
      });
      expect(subject.runRepository.runs.get('run-1')).not.toHaveProperty('waitingFor');
    });

    it('should emit run.wait-cleared after the wait is cleared when an answer is delivered', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      let waitingForAtEmit: unknown = 'unset';
      const baseEmit = subject.events.emit.bind(subject.events);
      subject.events.emit = (name, payload) => {
        if (name === 'run.wait-cleared') {
          waitingForAtEmit = subject.runRepository.runs.get('run-1')?.waitingFor;
        }
        baseEmit(name, payload);
      };
      const result = subject.service.waitForAnswer(buildRun(), {
        kind: 'checkpoint',
        request: 'Check',
      });
      await Promise.resolve();

      subject.runAnswerWaits.deliver('run-1', { kind: 'checkpoint', text: 'ok' });
      await result;

      expect(waitingForAtEmit).toBeUndefined();
      expect(subject.events.emittedEvents.map(({ name }) => name)).toEqual([
        'run.waiting',
        'run.wait-cleared',
      ]);
      expect(subject.events.emittedEvents[1]?.payload).toEqual({
        runId: 'run-1',
        projectId: 'moritz/aisf',
        ticketNumber: 137,
      });
    });

    it('should emit no run.wait-cleared when the answer window expires', async () => {
      const subject = buildWaitSubject();
      await insertRun(subject);
      const result = subject.service.waitForAnswer(buildRun(), {
        kind: 'checkpoint',
        request: 'Check',
      });
      await Promise.resolve();

      subject.runAnswerWaits.expire('run-1');
      await result;

      expect(subject.events.emittedEvents.map(({ name }) => name)).toEqual(['run.waiting']);
      expect(subject.finishCalls).toHaveLength(1);
    });
  });
});
