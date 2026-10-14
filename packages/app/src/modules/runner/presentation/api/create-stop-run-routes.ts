import { Hono } from 'hono';
import { statusForDomainError } from '../../../../shared/http.js';
import type { RunEndService } from '../../business/service/run-end-service.js';

export function createStopRunRoutes(runEndService: RunEndService): Hono {
  return new Hono().post('/api/runs/:runId/stop', async (context) => {
    try {
      await runEndService.stop(context.req.param('runId'));
      return context.body(null, 204);
    } catch (error) {
      const status = statusForDomainError(error);
      if (status === undefined || !(error instanceof Error)) {
        throw error;
      }
      return context.json({ message: error.message }, status);
    }
  });
}
