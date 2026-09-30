import { Hono } from 'hono';
import { RunNotActiveError } from '../../logic/errors/run-not-active-error.js';
import type { StopRunUseCase } from '../../logic/use-cases/stop-run-use-case.js';

export function createStopRunRoutes(stopRun: StopRunUseCase): Hono {
  return new Hono().post('/:runId/stop', async (context) => {
    try {
      await stopRun.execute(context.req.param('runId'));
      return context.body(null, 204);
    } catch (error) {
      if (error instanceof RunNotActiveError) {
        return context.json({ message: error.message }, 409);
      }
      throw error;
    }
  });
}
