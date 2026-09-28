import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createRunnerModule,
  RunAlreadyActiveError,
  type RunnerModule,
  type RunTool,
} from '../../../src/modules/runner/index.js';
import { FakeClock } from '../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../fakes/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRecentRunSteps,
  FakeRunRepository,
  FakeRunTargets,
  FakeWorktrees,
  SequentialIdentifiers,
} from './fakes/fake-runner-ports.js';

describe('createRunnerModule', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let events: FakeEventPublisher;
  let runner: RunnerModule;

  const appTool: RunTool = {
    name: 'aisf_report_finding',
    description: 'An app tool',
    inputShape: { summary: z.string() },
    execute: async () => ({ text: 'reported' }),
  };

  const startRequest = {
    projectId: 'moritz/aisf',
    ticketNumber: 137,
    stage: 'implement',
    mode: 'afk',
  } as const;

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    events = new FakeEventPublisher();
    runner = createRunnerModule({
      runRepository,
      agentSessions,
      worktrees: new FakeWorktrees(),
      runTargets: new FakeRunTargets({
        checkoutPath: '/checkouts/aisf',
        repositoryName: 'aisf',
        ticketTitle: 'The runner',
      }),
      recentRunSteps: new FakeRecentRunSteps(),
      identifiers: new SequentialIdentifiers(),
      clock: new FakeClock('2026-09-29T10:00:00.000Z'),
      events,
      worktreesDirectory: '/worktrees',
      appTools: [appTool],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it('should host aisf_escalate, aisf_park and the app tools in the session when a run starts', async () => {
    await runner.start(startRequest);

    expect(agentSessions.startedSpecs[0]?.tools.map((tool) => tool.name)).toEqual([
      'aisf_escalate',
      'aisf_park',
      'aisf_report_finding',
    ]);
  });

  it('should end the run as escalated and emit run.finished when the session calls aisf_escalate', async () => {
    await runner.start(startRequest);
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
          ending: { kind: 'escalated', escalation: 'red', reason: 'tests fail' },
        },
      },
    ]);
    expect(agentSessions.stoppedSessionIds).toEqual(['id-2']);
  });

  it('should end the run as parked and emit run.finished when the session calls aisf_park', async () => {
    await runner.start(startRequest);
    const park = agentSessions.startedSpecs[0]?.tools.find((tool) => tool.name === 'aisf_park');

    await park?.execute({ blocker: 42 });

    expect(events.emittedEvents[0]).toMatchObject({
      payload: { ending: { kind: 'parked', blockerNumber: 42 } },
    });
  });

  it('should fail with RunAlreadyActiveError when a start comes while the project has a running run', async () => {
    await runRepository.insert(buildRun({ id: 'other', ticketNumber: 12 }));

    await expect(runner.start(startRequest)).rejects.toThrow(RunAlreadyActiveError);
    expect(agentSessions.startedSpecs).toEqual([]);
  });

  it('should end the run as stopped when stop is called', async () => {
    const run = await runner.start(startRequest);

    await runner.stop(run.id);

    expect(events.emittedEvents[0]).toMatchObject({ payload: { ending: { kind: 'stopped' } } });
  });

  it('should return the running run with its steps when activeRun is asked', async () => {
    const run = await runner.start(startRequest);
    agentSessions.push('id-2', { kind: 'step', step: { at: 'a', summary: 'Read package.json' } });

    await vi.waitFor(async () =>
      expect((await runner.activeRun('moritz/aisf'))?.steps).toEqual([
        { at: 'a', summary: 'Read package.json' },
      ]),
    );
    expect((await runner.activeRun('moritz/aisf'))?.run).toEqual(run);
  });

  it('should settle an ended run when settle is called', async () => {
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));

    await runner.settle('run-1');

    expect(runRepository.runs.get('run-1')?.state).toBe('settled');
  });

  it('should end a running run as app-restarted when recover is called', async () => {
    await runRepository.insert(buildRun());

    await runner.recover();

    expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'app-restarted' });
  });

  it('should abort every session when abortSessions is called', () => {
    runner.abortSessions();

    expect(agentSessions.stopAllCalls).toBe(1);
  });
});
