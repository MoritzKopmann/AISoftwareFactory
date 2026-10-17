import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createAgentRunsModule, type AgentRunsModule } from './index.js';
import type { ProjectsApi } from '../projects/index.js';
import type { AgentTool } from '../../shared/agent-tools.js';
import { InMemoryAgentToolRegistry } from '../../shared/in-memory-agent-tool-registry.js';
import { FakeClock } from '../../shared/testing/fake-clock.js';
import type { DomainEvents, EventBus } from '../../shared/event-bus.js';
import { InMemoryEventBus } from '../../shared/in-memory-event-bus.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRunAnswerWaits,
  FakeRunRepository,
  FakeProjectPort,
  FakeRunTranscripts,
  FakeWorktrees,
  SequentialIdentifiers,
} from './testing/fake-agent-runs-ports.js';

class RecordingEventBus extends InMemoryEventBus<DomainEvents> implements EventBus {
  readonly emittedEvents: Array<{ readonly name: keyof DomainEvents; readonly payload: unknown }> =
    [];

  override emit<Name extends keyof DomainEvents>(name: Name, payload: DomainEvents[Name]): void {
    this.emittedEvents.push({ name, payload });
    super.emit(name, payload);
  }
}

describe('createAgentRunsModule', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let runAnswerWaits: FakeRunAnswerWaits;
  let runTranscripts: FakeRunTranscripts;
  let events: RecordingEventBus;
  let worktrees: FakeWorktrees;
  let agentTools: InMemoryAgentToolRegistry;
  let agentRuns: AgentRunsModule;

  const appTool: AgentTool = {
    name: 'aisf_report_finding',
    description: 'An app tool',
    inputShape: { summary: z.string() },
    execute: async () => ({ text: 'reported' }),
  };

  async function startRun() {
    const result = await agentRuns.internal.start(startRequest);
    if (result.kind !== 'started') {
      throw new Error(`Expected the run to start but got ${result.kind}`);
    }
    return result.run;
  }

  async function answerRun(
    runId: string,
    answer: Parameters<AgentRunsModule['internal']['answer']>[1],
  ) {
    const result = await agentRuns.internal.answer(runId, answer);
    if (result.kind !== 'answered') {
      throw new Error(`Expected the answer to land but got ${result.kind}`);
    }
    return result.run;
  }

  const startRequest = {
    projectId: 'moritz/aisf',
    ticketNumber: 137,
    mode: 'afk',
    ticketTitle: 'The runner',
    status: 'ready',
    types: [],
  } as const;

  beforeEach(() => {
    agentTools = new InMemoryAgentToolRegistry();
    agentTools.register(appTool);
    runRepository = new FakeRunRepository();
    runTranscripts = new FakeRunTranscripts();
    agentSessions = new FakeAgentSessions();
    runAnswerWaits = new FakeRunAnswerWaits();
    events = new RecordingEventBus();
    worktrees = new FakeWorktrees();
    agentRuns = createAgentRunsModule(
      {
        database: undefined as never,
        projects: {} as ProjectsApi,
        clock: new FakeClock('2026-09-29T10:00:00.000Z'),
        identifiers: new SequentialIdentifiers(),
        events,
        agentTools,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        claudeExecutablePath: '/bin/claude',
        pluginDirectory: '/plugin',
        worktreesDirectory: '/worktrees',
        liveAnswerWindowMilliseconds: 3_600_000,
      },
      {
        runRepository,
        agentSessions,
        worktrees,
        projectPort: new FakeProjectPort({
          checkoutPath: '/checkouts/aisf',
          repositoryName: 'aisf',
        }),
        runTranscripts,
        runAnswerWaits,
      },
    );
  });

  it('should host aisf_escalate, aisf_park, aisf_checkpoint and the app tools in the session when a run starts', async () => {
    await startRun();

    expect(agentSessions.startedSpecs[0]?.tools.map((tool) => tool.name)).toEqual([
      'aisf_escalate',
      'aisf_park',
      'aisf_checkpoint',
      'aisf_report_finding',
    ]);
  });

  it('should remove both worktrees of the ticket when ticket.closed is emitted', async () => {
    events.emit('ticket.closed', { projectId: 'moritz/aisf', ticketNumber: 7 });

    await vi.waitFor(() =>
      expect(worktrees.removedSpecs.map((spec) => spec.worktreePath)).toEqual([
        '/worktrees/aisf/7',
        '/worktrees/aisf/7-authoring',
      ]),
    );
  });

  it('should host a tool registered after the module was built when a run starts', async () => {
    agentTools.register({ ...appTool, name: 'aisf_late_tool' });

    await startRun();

    expect(agentSessions.startedSpecs[0]?.tools.map((tool) => tool.name)).toContain(
      'aisf_late_tool',
    );
  });

  it('should end the run as escalated and emit run.finished when the session calls aisf_escalate', async () => {
    await startRun();
    events.emittedEvents.length = 0;
    const escalate = agentSessions.startedSpecs[0]?.tools.find(
      (tool) => tool.name === 'aisf_escalate',
    );

    await escalate?.execute({ kind: 'red', reason: 'tests fail' });

    expect(events.emittedEvents).toEqual([
      {
        name: 'run.finished',
        payload: {
          runId: 'id-1',
          projectId: 'moritz/aisf',
          ticketNumber: 137,
          stage: 'implement',
          ending: { kind: 'escalated', escalation: 'red', reason: 'tests fail' },
        },
      },
    ]);
    expect(agentSessions.stoppedSessionIds).toEqual(['id-2']);
  });

  it('should end the run as parked and emit run.finished when the session calls aisf_park', async () => {
    await startRun();
    events.emittedEvents.length = 0;
    const park = agentSessions.startedSpecs[0]?.tools.find((tool) => tool.name === 'aisf_park');

    await park?.execute({ blocker: 42 });

    expect(events.emittedEvents[0]).toMatchObject({
      payload: { ending: { kind: 'parked', blockerNumber: 42 } },
    });
  });

  it('should wait, then end the run as checkpoint and emit run.finished when the window passes after aisf_checkpoint', async () => {
    await startRun();
    events.emittedEvents.length = 0;
    const checkpoint = agentSessions.startedSpecs[0]?.tools.find(
      (tool) => tool.name === 'aisf_checkpoint',
    );

    const held = checkpoint?.execute({ request: 'Check the page' });
    await vi.waitFor(() => expect(runAnswerWaits.isWaiting('id-1')).toBe(true));
    runAnswerWaits.expire('id-1');
    await held;

    expect(events.emittedEvents.map((event) => event.name)).toEqual([
      'run.waiting',
      'run.finished',
    ]);
    expect(events.emittedEvents.slice(1)).toEqual([
      {
        name: 'run.finished',
        payload: {
          runId: 'id-1',
          projectId: 'moritz/aisf',
          ticketNumber: 137,
          stage: 'implement',
          ending: { kind: 'checkpoint', request: 'Check the page' },
        },
      },
    ]);
    expect(agentSessions.stoppedSessionIds).toEqual(['id-2']);
    expect((await agentRuns.internal.findRun('id-1'))?.state).toBe('ended');
  });

  it('should return already-active when a start comes while the ticket has a running run', async () => {
    await runRepository.insert(buildRun({ id: 'other' }));

    expect(await agentRuns.internal.start(startRequest)).toEqual({
      kind: 'already-active',
      message: 'moritz/aisf already has a running run for #137',
    });
    expect(agentSessions.startedSpecs).toEqual([]);
  });

  it('should end the run as stopped when POST /api/runs/:runId/stop is called', async () => {
    const run = await startRun();
    events.emittedEvents.length = 0;

    const response = await agentRuns.routes.request(`/api/runs/${run.id}/stop`, { method: 'POST' });

    expect(response.status).toBe(204);
    expect(events.emittedEvents[0]).toMatchObject({ payload: { ending: { kind: 'stopped' } } });
  });

  it('should return the running run when activeRuns is asked', async () => {
    const run = await startRun();

    expect((await agentRuns.internal.activeRuns('moritz/aisf'))[0]).toEqual({ run });
  });

  it("should return the ticket's latest run when latestRun is asked", async () => {
    const run = await startRun();

    expect(await agentRuns.internal.latestRun('moritz/aisf', 137)).toEqual(run);
  });

  it('should answer 404 when GET /api/projects/:owner/:name/tickets/:number/run-log is called', async () => {
    const response = await agentRuns.routes.request(
      '/api/projects/moritz/aisf/tickets/137/run-log',
    );

    expect(response.status).toBe(404);
  });

  it('should resume the session with the app tools hosted when answer is called on a run needing permission', async () => {
    await runRepository.insert(
      buildRun({
        id: 'stuck-run',
        state: 'settled',
        ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'ls' } },
      }),
    );

    const resumed = await answerRun('stuck-run', { kind: 'permission', decision: 'allow' });

    expect(resumed.sessionId).toBe('session-1');
    expect(agentSessions.resumedSpecs[0]?.tools.map((tool) => tool.name)).toEqual([
      'aisf_escalate',
      'aisf_park',
      'aisf_checkpoint',
      'aisf_report_finding',
    ]);
  });

  it('should return already-active when answer resumes a run while the ticket has a running run', async () => {
    await runRepository.insert(
      buildRun({
        id: 'old-run',
        state: 'ended',
        ending: { kind: 'checkpoint', request: 'Check the page' },
        startedAt: '2026-09-29T11:00:00.000Z',
      }),
    );
    await runRepository.insert(
      buildRun({
        id: 'running-run',
        startedAt: '2026-09-29T10:00:00.000Z',
        sessionId: 'session-2',
      }),
    );

    expect(
      await agentRuns.internal.answer('old-run', { kind: 'checkpoint', text: 'Looks good' }),
    ).toMatchObject({ kind: 'already-active' });
  });

  it('should return not-resumable when answer is called on a run that did not need permission', async () => {
    await runRepository.insert(
      buildRun({ id: 'done-run', state: 'settled', ending: { kind: 'finished' } }),
    );

    expect(
      await agentRuns.internal.answer('done-run', { kind: 'permission', decision: 'allow' }),
    ).toMatchObject({ kind: 'not-resumable' });
  });

  it('should resume a checkpoint run with the app tools hosted when a checkpoint answer arrives', async () => {
    await runRepository.insert(
      buildRun({
        id: 'waiting-run',
        state: 'settled',
        ending: { kind: 'checkpoint', request: 'Check the page' },
      }),
    );

    const resumed = await answerRun('waiting-run', { kind: 'checkpoint', text: 'Looks right' });

    expect(resumed.sessionId).toBe('session-1');
    expect(agentSessions.resumedSpecs[0]?.tools.map((tool) => tool.name)).toContain(
      'aisf_checkpoint',
    );
  });

  it('should end the new run as checkpoint and keep the old ending when the resumed session checkpoints again', async () => {
    await runRepository.insert(
      buildRun({
        id: 'run-1',
        state: 'settled',
        ending: { kind: 'checkpoint', request: 'Check the page' },
      }),
    );
    await answerRun('run-1', { kind: 'checkpoint', text: 'It failed: the chip is missing' });
    const checkpoint = agentSessions.resumedSpecs[0]?.tools.find(
      (tool) => tool.name === 'aisf_checkpoint',
    );

    const held = checkpoint?.execute({ request: 'Check the page again' });
    await vi.waitFor(() => expect(runAnswerWaits.isWaiting('id-1')).toBe(true));
    runAnswerWaits.expire('id-1');
    await held;

    expect((await agentRuns.internal.findRun('id-1'))?.ending).toEqual({
      kind: 'checkpoint',
      request: 'Check the page again',
    });
    expect((await agentRuns.internal.findRun('run-1'))?.ending).toEqual({
      kind: 'checkpoint',
      request: 'Check the page',
    });
  });

  it('should hand a live checkpoint answer to the held call and return the waiting run when answer is called', async () => {
    const run = await startRun();
    const checkpoint = agentSessions.startedSpecs[0]?.tools.find(
      (tool) => tool.name === 'aisf_checkpoint',
    );
    const held = checkpoint?.execute({ request: 'Check the page' });
    await vi.waitFor(() => expect(runAnswerWaits.isWaiting(run.id)).toBe(true));

    const answered = await answerRun(run.id, { kind: 'checkpoint', text: 'Looks good' });

    expect(await held).toBe('Looks good');
    expect(answered.id).toBe(run.id);
    expect(agentSessions.resumedSpecs).toEqual([]);
  });

  it('should refuse every tool call and record nothing when the run was stopped', async () => {
    const run = await startRun();
    await runRepository.recordEnding(run.id, { kind: 'stopped' }, '2026-09-29T10:01:00.000Z');
    const tools = agentSessions.startedSpecs[0]?.tools ?? [];
    const eventCount = events.emittedEvents.length;

    const results = await Promise.all(
      tools.map((tool) => tool.execute({ request: 'x', kind: 'red', reason: 'x', blocker: 1 })),
    );

    expect(results.every((text) => text.includes('has ended'))).toBe(true);
    expect(runRepository.runs.get(run.id)?.ending).toEqual({ kind: 'stopped' });
    expect(events.emittedEvents).toHaveLength(eventCount);
  });

  it('should return the run when findRun is asked for a known run id', async () => {
    await runRepository.insert(buildRun({ id: 'known-run' }));

    expect((await agentRuns.internal.findRun('known-run'))?.id).toBe('known-run');
    expect(await agentRuns.internal.findRun('unknown-run')).toBeUndefined();
  });

  it('should settle an ended run when settle is called', async () => {
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));

    await agentRuns.internal.settle('run-1');

    expect(runRepository.runs.get('run-1')?.state).toBe('settled');
  });

  it('should end a running run as app-restarted when the agent-runs.recover-interrupted-runs job runs', async () => {
    await runRepository.insert(buildRun());

    await agentRuns.jobs['agent-runs.recover-interrupted-runs']?.();

    expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'app-restarted' });
  });

  it('should abort every session when the agent-runs.abort-sessions job runs', async () => {
    await agentRuns.jobs['agent-runs.abort-sessions']?.();

    expect(agentSessions.stopAllCalls).toBe(1);
  });
});
