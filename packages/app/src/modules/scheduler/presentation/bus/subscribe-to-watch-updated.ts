import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';

export function subscribeToWatchUpdated(
  subscriber: EventSubscriber,
  ticketRunService: Pick<TicketRunService, 'startDue'>,
  logger: Logger,
): () => void {
  return subscriber.on('watch.updated', ({ projectId }) => {
    // A bus handler must never reject: an unhandled rejection would end the process. Due work
    // left unstarted is retried on the next poll.
    ticketRunService.startDue(projectId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Starting due tickets of ${projectId} failed: ${message}`);
    });
  });
}
