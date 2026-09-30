import { Hono } from 'hono';
import { RunNotActiveError } from '../../../runner/index.js';

export type RunsPort = {
  readonly stop: (runId: string) => Promise<void>;
};

export function createStopRunRoutes(runs: RunsPort): Hono {
  return new Hono().post('/runs/:runId/stop', async (context) => {
    try {
      await runs.stop(context.req.param('runId'));
      return context.body(null, 204);
    } catch (error) {
      if (error instanceof RunNotActiveError) {
        return context.json({ message: error.message }, 409);
      }
      throw error;
    }
  });
}
