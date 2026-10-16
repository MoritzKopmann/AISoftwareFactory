import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { MergeService } from '../../business/service/merge-service.js';

export function subscribeToSnapshotChanged(
  subscriber: EventSubscriber,
  mergeService: Pick<MergeService, 'mergeApproved'>,
  logger: Logger,
): () => void {
  return subscriber.on('snapshot.changed', ({ projectId }) => {
    // A bus handler must never reject: an unhandled rejection would end the process. A pull
    // request left unmerged is retried when the next snapshot changes.
    mergeService.mergeApproved(projectId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Merging approved pull requests of ${projectId} failed: ${message}`);
    });
  });
}
