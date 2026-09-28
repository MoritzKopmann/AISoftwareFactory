import type { RepositoryReference } from '../domain/types/repository-reference.js';

export type RegisteredRepository = {
  readonly projectId: string;
  readonly repository: RepositoryReference;
};

export interface RegisteredRepositories {
  list(): Promise<ReadonlyArray<RegisteredRepository>>;
}
