import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';

export function subscribeToWatchUpdated(
  subscriber: EventSubscriber,
  ticketRunService: Pick<TicketRunService, 'continuePaused' | 'startDue'>,
  logger: Logger,
): () => void {
  return subscriber.on('watch.updated', ({ projectId }) => {
    // A bus handler must never reject: an unhandled rejection would end the process. Work left
    // undone is retried on the next poll.
    void continueThenStart(ticketRunService, logger, projectId);
  });
}

async function continueThenStart(
  ticketRunService: Pick<TicketRunService, 'continuePaused' | 'startDue'>,
  logger: Logger,
  projectId: string,
): Promise<void> {
  try {
    await ticketRunService.continuePaused(projectId);
  } catch (error) {
    logger.error(`Continuing paused runs of ${projectId} failed: ${describeError(error)}`);
  }
  try {
    await ticketRunService.startDue(projectId);
  } catch (error) {
    logger.error(`Starting due tickets of ${projectId} failed: ${describeError(error)}`);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
