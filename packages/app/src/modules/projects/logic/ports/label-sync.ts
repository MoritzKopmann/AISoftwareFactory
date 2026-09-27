import type { RepositoryReference } from './repository-resolver.js';

export interface LabelSync {
  sync(repository: RepositoryReference): Promise<void>;
}
