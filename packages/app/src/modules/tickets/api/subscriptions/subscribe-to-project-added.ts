import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';

export function subscribeToProjectAdded(
  subscriber: EventSubscriber,
  watchRepository: (projectId: string, repository: RepositoryReference) => void,
): () => void {
  return subscriber.on('project.added', ({ projectId, repository }) => {
    watchRepository(projectId, repository);
  });
}
