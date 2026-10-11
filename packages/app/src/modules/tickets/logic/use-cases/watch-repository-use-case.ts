import type { RepositoryReference } from '../domain/types/repository-reference.js';
import type { WatchStore } from '../ports/watch-store.js';

export type WatchRepositoryDependencies = {
  readonly watchStore: WatchStore;
};

export class WatchRepositoryUseCase {
  constructor(private readonly dependencies: WatchRepositoryDependencies) {}

  execute(projectId: string, repository: RepositoryReference): void {
    const { watchStore } = this.dependencies;
    if (watchStore.watch(projectId) === undefined) {
      watchStore.saveWatch({ projectId, repository, sync: { state: 'pending' } });
    }
  }
}
