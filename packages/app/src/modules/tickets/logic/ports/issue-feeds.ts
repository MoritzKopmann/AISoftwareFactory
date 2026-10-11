import type { RepositoryReference } from '../domain/types/repository-reference.js';

export interface IssueFeeds {
  changedSince(repository: RepositoryReference): Promise<boolean>;
}
