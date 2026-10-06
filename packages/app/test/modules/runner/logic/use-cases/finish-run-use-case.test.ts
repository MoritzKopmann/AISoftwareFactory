import { beforeEach, describe, expect, it } from 'vitest';
import { FinishRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/finish-run-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRunAnswerWaits,
  FakeRunRepository,
} from '../../fakes/fake-runner-ports.js';

describe('FinishRunUseCase', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let runAnswerWaits: FakeRunAnswerWaits;
  let events: FakeEventPublisher;
  let finishRun: FinishRunUseCase;

  beforeEach(async () => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    runAnswerWaits = new FakeRunAnswerWaits();
    events = new FakeEventPublisher();
    finishRun = new FinishRunUseCase({
      runRepository,
      agentSessions,
      runAnswerWaits,
      clock: new FakeClock('2026-09-29T11:00:00.000Z'),
      events,
    });
    await runRepository.insert(buildRun());
  });

  it('should persist the ending and stamp the end time when the run is running', async () => {
    await finishRun.execute('run-1', { kind: 'parked', blockerNumber: 42 });

    expect(runRepository.runs.get('run-1')).toMatchObject({
      state: 'ended',
      ending: { kind: 'parked', blockerNumber: 42 },
      endedAt: '2026-09-29T11:00:00.000Z',
    });
  });

  it('should emit run.finished with the ending when the run is running', async () => {
    await finishRun.execute('run-1', {
      kind: 'escalated',
      escalation: 'red',
      reason: 'tests fail',
    });

    expect(events.emittedEvents).toEqual([
      {
        name: 'run.finished',
        payload: {
          runId: 'run-1',
          projectId: 'moritz/aisf',
          ticketNumber: 137,
          ending: { kind: 'escalated', escalation: 'red', reason: 'tests fail' },
        },
      },
    ]);
  });

  it('should stop the session when the run is running', async () => {
    await finishRun.execute('run-1', { kind: 'stopped' });

    expect(agentSessions.stoppedSessionIds).toEqual(['session-1']);
  });

  it('should keep the first ending and emit nothing more when a second ending arrives', async () => {
    await finishRun.execute('run-1', { kind: 'parked', blockerNumber: 42 });

    await finishRun.execute('run-1', { kind: 'stopped' });

    expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'parked', blockerNumber: 42 });
    expect(events.emittedEvents).toHaveLength(1);
  });

  it('should do nothing when the run is unknown', async () => {
    await finishRun.execute('missing', { kind: 'stopped' });

    expect(events.emittedEvents).toEqual([]);
    expect(agentSessions.stoppedSessionIds).toEqual([]);
  });

  describe('when the run is waiting', () => {
    const waitingRun = buildRun({
      waitingFor: { kind: 'checkpoint', request: 'Check the page' },
      waitingSince: '2026-09-29T10:05:00.000Z',
    });

    beforeEach(async () => {
      runRepository.runs.clear();
      await runRepository.insert(waitingRun);
    });

    it('should end the run as a checkpoint and emit it when the ending is a crash', async () => {
      await finishRun.execute('run-1', { kind: 'crashed', reason: 'boom' });

      const checkpoint = { kind: 'checkpoint', request: 'Check the page' };
      expect(runRepository.runs.get('run-1')?.ending).toEqual(checkpoint);
      expect(events.emittedEvents).toMatchObject([
        { name: 'run.finished', payload: { ending: checkpoint } },
      ]);
    });

    it('should cancel the held wait when the run ends', async () => {
      const outcome = runAnswerWaits.wait('run-1', 1000);

      await finishRun.execute('run-1', { kind: 'stopped' });

      expect(await outcome).toEqual({ kind: 'cancelled' });
      expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'stopped' });
    });
  });
});
