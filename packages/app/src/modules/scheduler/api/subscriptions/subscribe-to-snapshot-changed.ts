import type { EventSubscriber } from '../../../../shared/bus/event-subscriber.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { MergeApprovedPullRequestsUseCase } from '../../logic/use-cases/merge-approved-pull-requests-use-case.js';

export function subscribeToSnapshotChanged(
  subscriber: EventSubscriber,
  mergeApprovedPullRequests: MergeApprovedPullRequestsUseCase,
  logger: Logger,
): () => void {
  return subscriber.on('snapshot.changed', ({ projectId }) => {
    // A bus handler must never reject: an unhandled rejection would end the process. A pull
    // request left unmerged is retried when the next snapshot changes.
    mergeApprovedPullRequests.execute(projectId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Merging approved pull requests of ${projectId} failed: ${message}`);
    });
  });
}
