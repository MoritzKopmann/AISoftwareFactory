import type { RepositoryWatchService } from '../../business/service/repository-watch-service.js';

/** Job `tickets.stop-watching`: ends the poll loop and drops the event subscriptions. */
export function createTicketsStopWatchingJob(
  repositoryWatchService: RepositoryWatchService,
  unsubscribe: () => void,
): () => Promise<void> {
  return () => {
    repositoryWatchService.stopWatching();
    unsubscribe();
    return Promise.resolve();
  };
}
