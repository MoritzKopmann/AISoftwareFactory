import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createStopRunRoutes } from '../../../../../src/modules/runner/api/routes/create-stop-run-routes.js';
import type { RunEnding } from '../../../../../src/modules/runner/logic/domain/types/run-ending.js';
import { StopRunUseCase } from '../../../../../src/modules/runner/logic/use-cases/stop-run-use-case.js';
import { buildRun, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

function createTestApp(runRepository: FakeRunRepository, endings: string[]): Hono {
  const stopRun = new StopRunUseCase({
    runRepository,
    finishRun: async (runId: string, ending: RunEnding) => {
      endings.push(`${runId} ${ending.kind}`);
    },
  });
  return new Hono().route('/runs', createStopRunRoutes(stopRun));
}

describe('createStopRunRoutes', () => {
  describe('POST /runs/:runId/stop', () => {
    it('should stop the run and answer 204 when the run is active', async () => {
      const runRepository = new FakeRunRepository();
      await runRepository.insert(buildRun({ id: 'run-1' }));
      const endings: string[] = [];

      const response = await createTestApp(runRepository, endings).request('/runs/run-1/stop', {
        method: 'POST',
      });

      expect(response.status).toBe(204);
      expect(endings).toEqual(['run-1 stopped']);
    });

    it('should answer 409 when the run is not active', async () => {
      const endings: string[] = [];

      const response = await createTestApp(new FakeRunRepository(), endings).request(
        '/runs/run-1/stop',
        { method: 'POST' },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: 'Run run-1 is not running' });
      expect(endings).toEqual([]);
    });
  });
});
