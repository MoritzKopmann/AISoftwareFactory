import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { ProjectService } from '../../business/service/project-service.js';

export function subscribeToTicketClosed(
  subscriber: EventSubscriber,
  projectService: Pick<ProjectService, 'refreshCheckout'>,
  logger: Logger,
): () => void {
  return subscriber.on('ticket.closed', ({ projectId }) => {
    // A bus handler must never reject: an unhandled rejection would end the process.
    projectService.refreshCheckout(projectId).catch((error: unknown) => {
      logger.error(
        `Refreshing the checkout of ${projectId} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  });
}
