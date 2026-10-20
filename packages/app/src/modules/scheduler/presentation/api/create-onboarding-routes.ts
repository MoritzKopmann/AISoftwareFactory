import { Hono } from 'hono';
import { statusForDomainError } from '../../../../shared/http.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import { toOnboardingResponse } from '../dto/mapper/onboarding-mapper.js';

export function createOnboardingRoutes(
  ticketRunService: Pick<TicketRunService, 'startOnboarding'>,
): Hono {
  return new Hono().post('/:owner/:name/onboarding', async (context) => {
    try {
      const ticketNumber = await ticketRunService.startOnboarding(
        `${context.req.param('owner')}/${context.req.param('name')}`,
        'manual',
      );
      // 'manual' always creates a ticket; only 'project-added' can return undefined.
      return context.json(toOnboardingResponse(ticketNumber ?? 0), 201);
    } catch (error) {
      const status = statusForDomainError(error);
      if (status === undefined || !(error instanceof Error)) {
        throw error;
      }
      return context.json({ message: error.message }, status);
    }
  });
}
