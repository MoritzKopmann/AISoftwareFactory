import { describe, expect, it } from 'vitest';
import { ReadActiveWaitsUseCase } from '../../../../../src/modules/runner/logic/use-cases/read-active-waits-use-case.js';
import { buildRun, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

describe('ReadActiveWaitsUseCase', () => {
  describe('execute', () => {
    it('should name each kind of wait when active runs wait for the human', async () => {
      const runRepository = new FakeRunRepository();
      await runRepository.insert(
        buildRun({
          id: 'run-1',
          ticketNumber: 5,
          waitingFor: { kind: 'checkpoint', request: 'Look', artifactId: 'page' },
          waitingSince: '2026-10-01T10:00:00Z',
        }),
      );
      await runRepository.insert(
        buildRun({
          id: 'run-2',
          ticketNumber: 6,
          waitingFor: { kind: 'checkpoint', request: 'Which one?' },
          waitingSince: '2026-10-01T10:01:00Z',
        }),
      );
      await runRepository.insert(
        buildRun({
          id: 'run-3',
          ticketNumber: 7,
          waitingFor: { kind: 'permission-needed', toolName: 'Bash', toolInput: {} },
          waitingSince: '2026-10-01T10:02:00Z',
        }),
      );

      const waits = await new ReadActiveWaitsUseCase({ runRepository }).execute('moritz/aisf');

      expect(waits).toEqual([
        { ticketNumber: 5, kind: 'round', since: '2026-10-01T10:00:00Z' },
        { ticketNumber: 6, kind: 'question', since: '2026-10-01T10:01:00Z' },
        { ticketNumber: 7, kind: 'permission', since: '2026-10-01T10:02:00Z' },
      ]);
    });

    it('should skip active runs when they are not waiting', async () => {
      const runRepository = new FakeRunRepository();
      await runRepository.insert(buildRun());

      expect(await new ReadActiveWaitsUseCase({ runRepository }).execute('moritz/aisf')).toEqual(
        [],
      );
    });
  });
});
