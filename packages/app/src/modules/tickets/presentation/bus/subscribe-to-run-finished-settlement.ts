import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { TicketStatusService } from '../../business/service/ticket-status-service.js';

export function subscribeToRunFinishedSettlement(
  subscriber: EventSubscriber,
  ticketStatusService: Pick<TicketStatusService, 'settleFinishedRun'>,
  logger: Logger,
): () => void {
  return subscriber.on('run.finished', (finishedRun) => {
    // A bus handler must never reject: an unhandled rejection would end the process. An
    // unsettled run is replayed at the next start.
    ticketStatusService.settleFinishedRun(finishedRun).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Settling run ${finishedRun.runId} failed: ${message}`);
    });
  });
}
