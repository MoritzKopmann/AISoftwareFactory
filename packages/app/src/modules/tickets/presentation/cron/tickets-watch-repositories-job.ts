import type { RepositoryWatchService } from '../../business/service/repository-watch-service.js';

/** Job `tickets.watch-repositories`: watches every registered repository and starts the poll loop. */
export function createTicketsWatchRepositoriesJob(
  repositoryWatchService: RepositoryWatchService,
): () => Promise<void> {
  return () => repositoryWatchService.startWatching();
}
