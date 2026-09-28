import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { z } from 'zod';
import type { RunEnding } from '../../../../../src/modules/runner/logic/domain/types/run-ending.js';
import type { RunTool } from '../../../../../src/modules/runner/logic/domain/types/run-tool.js';
import { RunAlreadyActiveError } from '../../../../../src/modules/runner/logic/errors/run-already-active-error.js';
import { RunTargetNotFoundError } from '../../../../../src/modules/runner/logic/errors/run-target-not-found-error.js';
import { WorktreeSetupFailedError } from '../../../../../src/modules/runner/logic/errors/worktree-setup-failed-error.js';
import { FinishRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/finish-run-use-case.js';
import { StartRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/start-run-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRecentRunSteps,
  FakeRunRepository,
  FakeRunTargets,
  FakeWorktrees,
  SequentialIdentifiers,
} from '../../fakes/fake-runner-ports.js';

describe('StartRunUseCase', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let worktrees: FakeWorktrees;
  let recentRunSteps: FakeRecentRunSteps;
  let events: FakeEventPublisher;
  let logger: { info: Mock; warn: Mock; error: Mock };
  let executedContexts: unknown[];
  let tools: RunTool[];
  let startRun: StartRunUseCase;

  const startRequest = {
    projectId: 'moritz/aisf',
    ticketNumber: 137,
    stage: 'implement',
    mode: 'afk',
  } as const;

  function buildStartRun(runTargets = new FakeRunTargets(target)): StartRunUseCase {
    const clock = new FakeClock('2026-09-29T10:00:00.000Z');
    return new StartRunUseCase({
      runRepository,
      agentSessions,
      worktrees,
      runTargets,
      recentRunSteps,
      identifiers: new SequentialIdentifiers(),
      clock,
      finishRun: (runId, ending) =>
        new FinishRunUseCase({ runRepository, agentSessions, clock, events }).execute(
          runId,
          ending,
        ),
      tools,
      worktreesDirectory: '/worktrees',
      logger,
    });
  }

  const target = {
    checkoutPath: '/checkouts/aisf',
    repositoryName: 'aisf',
    ticketTitle: 'The runner takes a ticket',
  };

  function endingOf(runId: string): RunEnding | undefined {
    return runRepository.runs.get(runId)?.ending;
  }

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    worktrees = new FakeWorktrees();
    recentRunSteps = new FakeRecentRunSteps();
    events = new FakeEventPublisher();
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    executedContexts = [];
    tools = [
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
    startRun = buildStartRun();
  });

  it('should return a running run on the ticket branch and worktree when nothing else is running', async () => {
    const run = await startRun.execute(startRequest);

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
    await startRun.execute(startRequest);

    expect(worktrees.ensuredSpecs).toEqual([
      {
        checkoutPath: '/checkouts/aisf',
        worktreePath: '/worktrees/aisf/137',
        branchName: 'aisf/137-the-runner-takes-a-ticket',
      },
    ]);
  });

  it('should start the session with the preset id, the implement command and the stage model when the run starts', async () => {
    await startRun.execute(startRequest);

    expect(agentSessions.startedSpecs).toHaveLength(1);
    expect(agentSessions.startedSpecs[0]).toMatchObject({
      sessionId: 'id-2',
      worktreePath: '/worktrees/aisf/137',
      prompt: '/aisf:implement-ticket 137',
      model: 'sonnet',
    });
  });

  it('should throw RunAlreadyActiveError and start nothing when another run in the project is running', async () => {
    await runRepository.insert(buildRun({ id: 'other-run', ticketNumber: 12 }));

    await expect(startRun.execute(startRequest)).rejects.toThrow(RunAlreadyActiveError);

    expect(worktrees.ensuredSpecs).toEqual([]);
    expect(agentSessions.startedSpecs).toEqual([]);
  });

  it('should throw RunTargetNotFoundError and insert nothing when the project or ticket is unknown', async () => {
    startRun = buildStartRun(new FakeRunTargets(undefined));

    await expect(startRun.execute(startRequest)).rejects.toThrow(RunTargetNotFoundError);

    expect(runRepository.runs.size).toBe(0);
  });

  it('should end the run as crashed, emit run.finished and rethrow when the worktree cannot be set up', async () => {
    worktrees.failure = new WorktreeSetupFailedError('git worktree add failed');

    await expect(startRun.execute(startRequest)).rejects.toThrow(WorktreeSetupFailedError);

    expect(endingOf('id-1')).toEqual({ kind: 'crashed', reason: 'git worktree add failed' });
    expect(events.emittedEvents).toHaveLength(1);
    expect(agentSessions.startedSpecs).toEqual([]);
  });

  it('should keep the steps the session reports when it runs', async () => {
    await startRun.execute(startRequest);

    agentSessions.push('id-2', { kind: 'step', step: { at: 'a', summary: 'Read package.json' } });
    agentSessions.push('id-2', { kind: 'completed' });

    await vi.waitFor(() => expect(events.emittedEvents).toHaveLength(1));
    expect(recentRunSteps.read('id-1')).toEqual([{ at: 'a', summary: 'Read package.json' }]);
  });

  it('should end the run as finished and emit run.finished when the session completes', async () => {
    await startRun.execute(startRequest);

    agentSessions.push('id-2', { kind: 'completed' });

    await vi.waitFor(() => expect(events.emittedEvents).toHaveLength(1));
    expect(endingOf('id-1')).toEqual({ kind: 'finished' });
    expect(events.emittedEvents[0]).toMatchObject({
      name: 'run.finished',
      payload: { runId: 'id-1', ending: { kind: 'finished' } },
    });
  });

  it('should end the run as permission-needed with the tool call and close the session when a permission prompt appears', async () => {
    await startRun.execute(startRequest);

    agentSessions.push('id-2', {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'git config --local x 1' },
    });

    await vi.waitFor(() => expect(events.emittedEvents).toHaveLength(1));
    expect(endingOf('id-1')).toEqual({
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'git config --local x 1' },
    });
    expect(agentSessions.stoppedSessionIds).toEqual(['id-2']);
  });

  it('should end the run as usage-limit with the reason when the session reports the limit', async () => {
    await startRun.execute(startRequest);

    agentSessions.push('id-2', { kind: 'usage-limit', reason: 'five_hour limit rejected' });

    await vi.waitFor(() => expect(events.emittedEvents).toHaveLength(1));
    expect(endingOf('id-1')).toEqual({ kind: 'usage-limit', reason: 'five_hour limit rejected' });
  });

  it('should end the run as crashed with the reason when the session reports a crash', async () => {
    await startRun.execute(startRequest);

    agentSessions.push('id-2', { kind: 'crashed', reason: 'Login expired' });

    await vi.waitFor(() => expect(events.emittedEvents).toHaveLength(1));
    expect(endingOf('id-1')).toEqual({ kind: 'crashed', reason: 'Login expired' });
  });

  it('should end the run as crashed with the error message when the session stream throws', async () => {
    await startRun.execute(startRequest);

    agentSessions.fail('id-2', new Error('spawn claude ENOENT'));

    await vi.waitFor(() => expect(events.emittedEvents).toHaveLength(1));
    expect(endingOf('id-1')).toEqual({ kind: 'crashed', reason: 'spawn claude ENOENT' });
  });

  it('should log the failure instead of leaving a rejection unhandled when recording the ending throws', async () => {
    events.emit = () => {
      throw new Error('subscriber failed');
    };
    await startRun.execute(startRequest);

    agentSessions.push('id-2', { kind: 'completed' });

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledOnce());
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('subscriber failed'));
  });

  it('should hand the session every tool with the run context bound when the run starts', async () => {
    await startRun.execute(startRequest);
    const sessionTools = agentSessions.startedSpecs[0]?.tools ?? [];

    const probeResult = await sessionTools
      .find((tool) => tool.name === 'aisf_probe')
      ?.execute({
        value: 'x',
      });

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
    expect(endingOf('id-1')).toBeUndefined();
  });

  it('should end the run with the tool ending and close the session when a tool returns an ending', async () => {
    await startRun.execute(startRequest);
    const sessionTools = agentSessions.startedSpecs[0]?.tools ?? [];

    const endingResult = await sessionTools
      .find((tool) => tool.name === 'aisf_ending')
      ?.execute({});

    expect(endingResult).toBe('ended');
    expect(endingOf('id-1')).toEqual({ kind: 'parked', blockerNumber: 42 });
    expect(agentSessions.stoppedSessionIds).toEqual(['id-2']);
    expect(events.emittedEvents).toHaveLength(1);
  });
});
