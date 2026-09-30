import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { RunNotActiveError } from '../../../../../src/modules/runner/index.js';
import {
  createStopRunRoutes,
  type RunsPort,
} from '../../../../../src/modules/ui/api/routes/create-stop-run-routes.js';

class FakeRunsPort implements RunsPort {
  stopFailure: Error | undefined;
  readonly calls: string[] = [];

  async stop(runId: string): Promise<void> {
    this.calls.push(`stop ${runId}`);
    if (this.stopFailure !== undefined) {
      throw this.stopFailure;
    }
  }
}

function createTestApp(runs: RunsPort): Hono {
  return new Hono().route('/', createStopRunRoutes(runs));
}

describe('createStopRunRoutes', () => {
  describe('POST /runs/:runId/stop', () => {
    it('should stop the run and answer 204 when the run is active', async () => {
      const runs = new FakeRunsPort();

      const response = await createTestApp(runs).request('/runs/run-1/stop', { method: 'POST' });

      expect(response.status).toBe(204);
      expect(runs.calls).toEqual(['stop run-1']);
    });

    it('should answer 409 when the run is not active', async () => {
      const runs = new FakeRunsPort();
      runs.stopFailure = new RunNotActiveError('Run run-1 is not running');

      const response = await createTestApp(runs).request('/runs/run-1/stop', { method: 'POST' });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: 'Run run-1 is not running' });
    });
  });
});
