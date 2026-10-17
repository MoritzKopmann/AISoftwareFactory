import { Hono } from 'hono';
import type { TicketReadService } from '../../business/service/ticket-read-service.js';
import type { TicketStatusService } from '../../business/service/ticket-status-service.js';
import { createNeedsYouRoutes } from './create-needs-you-routes.js';
import { createTicketMoveToPlanRoutes } from './create-ticket-move-to-plan-routes.js';
import { createTicketReadRoutes } from './create-ticket-read-routes.js';
import { createTicketResetRoutes } from './create-ticket-reset-routes.js';

/** The module's route table, with full paths. */
export function createTicketsRoutes(services: {
  readonly ticketReadService: TicketReadService;
  readonly ticketStatusService: TicketStatusService;
}): Hono {
  return new Hono()
    .route('/api/projects', createTicketReadRoutes(services.ticketReadService))
    .route('/api/projects', createNeedsYouRoutes(services.ticketReadService))
    .route('/api/projects', createTicketResetRoutes(services.ticketStatusService))
    .route('/api/projects', createTicketMoveToPlanRoutes(services.ticketStatusService));
}
