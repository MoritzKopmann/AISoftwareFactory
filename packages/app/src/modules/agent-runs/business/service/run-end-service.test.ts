import { beforeEach, describe, expect, it } from 'vitest';
import { RunNotActiveError } from '../errors/run-not-active-error.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRunAnswerWaits,
  FakeRunRepository,
} from '../../testing/fake-agent-runs-ports.js';
import { RunEndService } from './run-end-service.js';

describe('RunEndService', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let runAnswerWaits: FakeRunAnswerWaits;
  let events: FakeEventPublisher;
  let runEndService: RunEndService;

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    runAnswerWaits = new FakeRunAnswerWaits();
    events = new FakeEventPublisher();
    runEndService = new RunEndService({
      runRepository,
      agentSessions,
      runAnswerWaits,
      clock: new FakeClock('2026-09-29T11:00:00.000Z'),
      events,
    });
  });

  describe('finish', () => {
    beforeEach(async () => {
      await runRepository.insert(buildRun());
    });

    it('should persist the ending and stamp the end time when the run is running', async () => {
      await runEndService.finish('run-1', { kind: 'parked', blockerNumber: 42 });

      expect(runRepository.runs.get('run-1')).toMatchObject({
        state: 'ended',
        ending: { kind: 'parked', blockerNumber: 42 },
        endedAt: '2026-09-29T11:00:00.000Z',
      });
    });

    it('should emit run.finished with the ending when the run is running', async () => {
      await runEndService.finish('run-1', {
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
            stage: 'implement',
            ending: { kind: 'escalated', escalation: 'red', reason: 'tests fail' },
          },
        },
      ]);
    });

    it('should stop the session when the run is running', async () => {
      await runEndService.finish('run-1', { kind: 'stopped' });

      expect(agentSessions.stoppedSessionIds).toEqual(['session-1']);
    });

    it('should keep the first ending and emit nothing more when a second ending arrives', async () => {
      await runEndService.finish('run-1', { kind: 'parked', blockerNumber: 42 });

      await runEndService.finish('run-1', { kind: 'stopped' });

      expect(runRepository.runs.get('run-1')?.ending).toEqual({
        kind: 'parked',
        blockerNumber: 42,
      });
      expect(events.emittedEvents).toHaveLength(1);
    });

    it('should do nothing when the run is unknown', async () => {
      await runEndService.finish('missing', { kind: 'stopped' });

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
        await runEndService.finish('run-1', { kind: 'crashed', reason: 'boom' });

        const checkpoint = { kind: 'checkpoint', request: 'Check the page' };
        expect(runRepository.runs.get('run-1')?.ending).toEqual(checkpoint);
        expect(events.emittedEvents).toMatchObject([
          { name: 'run.finished', payload: { ending: checkpoint } },
        ]);
      });

      it('should cancel the held wait when the run ends', async () => {
        const outcome = runAnswerWaits.wait('run-1', 1000);

        await runEndService.finish('run-1', { kind: 'stopped' });

        expect(await outcome).toEqual({ kind: 'cancelled' });
        expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'stopped' });
      });
    });
  });

  describe('stop', () => {
    it('should end the run as stopped and stop its session when the run is running', async () => {
      await runRepository.insert(buildRun());

      await runEndService.stop('run-1');

      expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'stopped' });
      expect(agentSessions.stoppedSessionIds).toEqual(['session-1']);
      expect(events.emittedEvents).toHaveLength(1);
    });

    it('should throw RunNotActiveError when the run is unknown', async () => {
      await expect(runEndService.stop('missing')).rejects.toThrow(RunNotActiveError);
    });

    it('should throw RunNotActiveError when the run has already ended', async () => {
      await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));

      await expect(runEndService.stop('run-1')).rejects.toThrow(RunNotActiveError);
    });

    it('should end a waiting run stopped, release the held call and stop the session', async () => {
      await runRepository.insert(
        buildRun({
          waitingFor: { kind: 'checkpoint', request: 'Check', artifactId: 'confirm-plan' },
          waitingSince: '2026-09-29T10:05:00.000Z',
        }),
      );
      const outcome = runAnswerWaits.wait('run-1', 1000);

      await runEndService.stop('run-1');

      expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'stopped' });
      expect(await outcome).toEqual({ kind: 'cancelled' });
      expect(agentSessions.stoppedSessionIds).toEqual(['session-1']);
    });
  });

  describe('settle', () => {
    it('should mark an ended run as settled when its ending has been written to GitHub', async () => {
      await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));
      await runEndService.settle('run-1');

      expect(runRepository.runs.get('run-1')?.state).toBe('settled');
    });
  });

  describe('recoverInterrupted', () => {
    it('should end a running run as app-restarted and emit run.finished when the app restarts', async () => {
      await runRepository.insert(buildRun());

      await runEndService.recoverInterrupted();

      expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'app-restarted' });
      expect(events.emittedEvents).toEqual([
        {
          name: 'run.finished',
          payload: {
            runId: 'run-1',
            projectId: 'moritz/aisf',
            ticketNumber: 137,
            stage: 'implement',
            ending: { kind: 'app-restarted' },
          },
        },
      ]);
    });

    it('should emit run.finished again with the recorded ending when an ended run is not settled', async () => {
      await runRepository.insert(
        buildRun({ state: 'ended', ending: { kind: 'parked', blockerNumber: 42 } }),
      );

      await runEndService.recoverInterrupted();

      expect(events.emittedEvents).toEqual([
        {
          name: 'run.finished',
          payload: {
            runId: 'run-1',
            projectId: 'moritz/aisf',
            ticketNumber: 137,
            stage: 'implement',
            ending: { kind: 'parked', blockerNumber: 42 },
          },
        },
      ]);
    });

    it('should leave a settled run alone when the app restarts', async () => {
      await runRepository.insert(buildRun({ state: 'settled', ending: { kind: 'finished' } }));

      await runEndService.recoverInterrupted();

      expect(events.emittedEvents).toEqual([]);
    });

    it('should end a waiting run as a checkpoint when the app restarts', async () => {
      await runRepository.insert(
        buildRun({ waitingFor: { kind: 'checkpoint', request: 'Check the page' } }),
      );

      await runEndService.recoverInterrupted();

      expect(runRepository.runs.get('run-1')?.ending).toEqual({
        kind: 'checkpoint',
        request: 'Check the page',
      });
    });
  });

  describe('abortSessions', () => {
    it('should stop every live session when sessions are aborted', () => {
      runEndService.abortSessions();

      expect(agentSessions.stopAllCalls).toBe(1);
    });
  });
});
