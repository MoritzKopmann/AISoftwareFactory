import { beforeEach, describe, expect, it } from 'vitest';
import { FinishRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/finish-run-use-case.js';
import { RecoverInterruptedRunsUseCase } from '../../../../../src/modules/runner/logic/use-cases/recover-interrupted-runs-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRunAnswerWaits,
  FakeRunRepository,
} from '../../fakes/fake-runner-ports.js';

describe('RecoverInterruptedRunsUseCase', () => {
  let runRepository: FakeRunRepository;
  let events: FakeEventPublisher;
  let recoverInterruptedRuns: RecoverInterruptedRunsUseCase;

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    events = new FakeEventPublisher();
    const finishRun = new FinishRunUseCase({
      runRepository,
      agentSessions: new FakeAgentSessions(),
      runAnswerWaits: new FakeRunAnswerWaits(),
      clock: new FakeClock('2026-09-29T12:00:00.000Z'),
      events,
    });
    recoverInterruptedRuns = new RecoverInterruptedRunsUseCase({
      runRepository,
      finishRun: (runId, ending) => finishRun.execute(runId, ending),
      events,
    });
  });

  it('should end a running run as app-restarted and emit run.finished when the app restarts', async () => {
    await runRepository.insert(buildRun());

    await recoverInterruptedRuns.execute();

    expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'app-restarted' });
    expect(events.emittedEvents).toEqual([
      {
        name: 'run.finished',
        payload: {
          runId: 'run-1',
          projectId: 'moritz/aisf',
          ticketNumber: 137,
          ending: { kind: 'app-restarted' },
        },
      },
    ]);
  });

  it('should emit run.finished again with the recorded ending when an ended run is not settled', async () => {
    await runRepository.insert(
      buildRun({ state: 'ended', ending: { kind: 'parked', blockerNumber: 42 } }),
    );

    await recoverInterruptedRuns.execute();

    expect(events.emittedEvents).toEqual([
      {
        name: 'run.finished',
        payload: {
          runId: 'run-1',
          projectId: 'moritz/aisf',
          ticketNumber: 137,
          ending: { kind: 'parked', blockerNumber: 42 },
        },
      },
    ]);
  });

  it('should leave a settled run alone when the app restarts', async () => {
    await runRepository.insert(buildRun({ state: 'settled', ending: { kind: 'finished' } }));

    await recoverInterruptedRuns.execute();

    expect(events.emittedEvents).toEqual([]);
  });

  it('should end a waiting run as a checkpoint when the app restarts', async () => {
    await runRepository.insert(
      buildRun({ waitingFor: { kind: 'checkpoint', request: 'Check the page' } }),
    );

    await recoverInterruptedRuns.execute();

    expect(runRepository.runs.get('run-1')?.ending).toEqual({
      kind: 'checkpoint',
      request: 'Check the page',
    });
  });
});
