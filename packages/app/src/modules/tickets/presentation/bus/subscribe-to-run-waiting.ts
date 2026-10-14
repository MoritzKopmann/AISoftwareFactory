import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { TicketStatusService } from '../../business/service/ticket-status-service.js';

export function subscribeToRunWaiting(
  subscriber: EventSubscriber,
  ticketStatusService: Pick<TicketStatusService, 'settleWaitingRun'>,
  logger: Logger,
): () => void {
  return subscriber.on('run.waiting', (waitingRun) => {
    // A bus handler must never reject: an unhandled rejection would end the process. A failed
    // write is not retried: the fallback ending writes the status later.
    ticketStatusService.settleWaitingRun(waitingRun).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Marking run ${waitingRun.runId} waiting failed: ${message}`);
    });
  });
}
