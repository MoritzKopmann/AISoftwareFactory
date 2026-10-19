import type { EventPublisher, EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { UsageService } from '../../business/service/usage-service.js';

export function subscribeToUsageWindowObserved(
  events: EventSubscriber & EventPublisher,
  usageService: Pick<UsageService, 'recordObservation'>,
  logger: Logger,
): () => void {
  return events.on('usage.window-observed', (observation) => {
    // A bus handler must never reject: an unhandled rejection would end the process. A failed
    // record is dropped; the next observation carries the windows again.
    usageService
      .recordObservation(observation)
      .then((changed) => {
        if (changed) {
          events.emit('usage.changed', {});
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Recording the usage observation failed: ${message}`);
      });
  });
}
