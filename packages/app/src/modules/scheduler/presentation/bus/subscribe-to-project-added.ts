import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';

export function subscribeToProjectAdded(
  subscriber: EventSubscriber,
  ticketRunService: Pick<TicketRunService, 'startOnboarding'>,
  logger: Logger,
): () => void {
  return subscriber.on('project.added', ({ projectId }) => {
    // A bus handler must never reject, and Add project must not fail because of onboarding.
    void startOnboarding(ticketRunService, logger, projectId);
  });
}

async function startOnboarding(
  ticketRunService: Pick<TicketRunService, 'startOnboarding'>,
  logger: Logger,
  projectId: string,
): Promise<void> {
  try {
    await ticketRunService.startOnboarding(projectId, 'project-added');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Starting onboarding of ${projectId} failed: ${message}`);
  }
}
