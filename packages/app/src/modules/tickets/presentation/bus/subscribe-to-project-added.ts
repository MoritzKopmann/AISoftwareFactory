import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { RepositoryWatchService } from '../../business/service/repository-watch-service.js';

export function subscribeToProjectAdded(
  subscriber: EventSubscriber,
  repositoryWatchService: Pick<RepositoryWatchService, 'watchAndPoll'>,
): () => void {
  return subscriber.on('project.added', ({ projectId, repository }) => {
    void repositoryWatchService.watchAndPoll(projectId, repository);
  });
}
