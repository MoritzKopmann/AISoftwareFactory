import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { RepositoryWatchService } from '../../business/service/repository-watch-service.js';

export function subscribeToRunFinished(
  subscriber: EventSubscriber,
  repositoryWatchService: Pick<RepositoryWatchService, 'requestPoll'>,
): () => void {
  return subscriber.on('run.finished', () => {
    void repositoryWatchService.requestPoll();
  });
}
