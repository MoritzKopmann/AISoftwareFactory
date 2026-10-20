import { Hono } from 'hono';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import { createIdeaRoutes } from './create-idea-routes.js';
import { createOnboardingRoutes } from './create-onboarding-routes.js';
import { createRunAnswerRoutes } from './create-run-answer-routes.js';
import { createRunRoutes } from './create-run-routes.js';

/** The module's route table, with full paths. */
export function createSchedulerRoutes(services: {
  readonly ticketRunService: TicketRunService;
}): Hono {
  return new Hono()
    .route('/api/projects', createRunRoutes(services.ticketRunService))
    .route('/api/projects', createIdeaRoutes(services.ticketRunService))
    .route('/api/projects', createOnboardingRoutes(services.ticketRunService))
    .route('/api/runs', createRunAnswerRoutes(services.ticketRunService));
}
