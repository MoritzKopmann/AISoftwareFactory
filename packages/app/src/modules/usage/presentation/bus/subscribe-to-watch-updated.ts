import type { EventPublisher, EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { UsageRefreshService } from '../../business/service/usage-refresh-service.js';

export function subscribeToWatchUpdated(
  events: EventSubscriber & EventPublisher,
  usageRefreshService: Pick<UsageRefreshService, 'refreshIfStale'>,
  logger: Logger,
): () => void {
  return events.on('watch.updated', () => {
    // A bus handler must never reject: an unhandled rejection would end the process. A failed
    // read is logged; a later tick tries again once the wait is over.
    usageRefreshService
      .refreshIfStale()
      .then((changed) => {
        if (changed) {
          events.emit('usage.changed', {});
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Refreshing the usage failed: ${message}`);
      });
  });
}
