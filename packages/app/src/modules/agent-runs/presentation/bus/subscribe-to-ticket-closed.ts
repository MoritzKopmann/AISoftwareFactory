import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import { describeError } from '../../business/domain/functions/describe-error.js';
import type { WorktreeRemovalService } from '../../business/service/worktree-removal-service.js';

export function subscribeToTicketClosed(
  subscriber: EventSubscriber,
  worktreeRemovalService: Pick<WorktreeRemovalService, 'removeForClosedTicket'>,
  logger: Logger,
): () => void {
  return subscriber.on('ticket.closed', ({ projectId, ticketNumber }) => {
    // A bus handler must never reject: an unhandled rejection would end the process.
    worktreeRemovalService
      .removeForClosedTicket(projectId, ticketNumber)
      .catch((error: unknown) => {
        logger.error(
          `Removing worktrees of #${ticketNumber} of ${projectId} failed: ${describeError(error)}`,
        );
      });
  });
}
