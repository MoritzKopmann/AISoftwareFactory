import { beforeEach, describe, expect, it } from 'vitest';
import { RunNotActiveError } from '../../../../../src/modules/runner/logic/errors/run-not-active-error.js';
import { FinishRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/finish-run-use-case.js';
import { StopRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/stop-run-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRunAnswerWaits,
  FakeRunRepository,
} from '../../fakes/fake-runner-ports.js';

describe('StopRunUseCase', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let runAnswerWaits: FakeRunAnswerWaits;
  let events: FakeEventPublisher;
  let stopRun: StopRunUseCase;

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    runAnswerWaits = new FakeRunAnswerWaits();
    events = new FakeEventPublisher();
    const finishRun = new FinishRunUseCase({
      runRepository,
      agentSessions,
      runAnswerWaits,
      clock: new FakeClock('2026-09-29T11:00:00.000Z'),
      events,
    });
    stopRun = new StopRunUseCase({
      runRepository,
      finishRun: (runId, ending) => finishRun.execute(runId, ending),
    });
  });

  it('should end the run as stopped and stop its session when the run is running', async () => {
    await runRepository.insert(buildRun());

    await stopRun.execute('run-1');

    expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'stopped' });
    expect(agentSessions.stoppedSessionIds).toEqual(['session-1']);
    expect(events.emittedEvents).toHaveLength(1);
  });

  it('should throw RunNotActiveError when the run is unknown', async () => {
    await expect(stopRun.execute('missing')).rejects.toThrow(RunNotActiveError);
  });

  it('should throw RunNotActiveError when the run has already ended', async () => {
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));

    await expect(stopRun.execute('run-1')).rejects.toThrow(RunNotActiveError);
  });

  it('should end a waiting run stopped, release the held call and stop the session', async () => {
    await runRepository.insert(
      buildRun({
        waitingFor: { kind: 'checkpoint', request: 'Check', artifactId: 'confirm-plan' },
        waitingSince: '2026-09-29T10:05:00.000Z',
      }),
    );
    const outcome = runAnswerWaits.wait('run-1', 1000);

    await stopRun.execute('run-1');

    expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'stopped' });
    expect(await outcome).toEqual({ kind: 'cancelled' });
    expect(agentSessions.stoppedSessionIds).toEqual(['session-1']);
  });
});
