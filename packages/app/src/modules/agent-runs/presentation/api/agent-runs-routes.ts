import { Hono } from 'hono';
import type { RunEndService } from '../../business/service/run-end-service.js';
import type { RunQueryService } from '../../business/service/run-query-service.js';
import { createSessionStreamRoutes } from './create-session-stream-routes.js';
import { createStopRunRoutes } from './create-stop-run-routes.js';

/** The module's route table, with full paths. */
export function createAgentRunsRoutes(services: {
  readonly runEndService: RunEndService;
  readonly runQueryService: RunQueryService;
}): Hono {
  return new Hono()
    .route('/', createStopRunRoutes(services.runEndService))
    .route('/', createSessionStreamRoutes(services.runQueryService));
}
