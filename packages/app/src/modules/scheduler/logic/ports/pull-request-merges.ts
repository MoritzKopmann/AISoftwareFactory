import type { RepositoryReference } from '../domain/types/repository-reference.js';

export interface PullRequestMerges {
  merge(
    repository: RepositoryReference,
    pullRequestNumber: number,
    headCommit: string,
  ): Promise<void>;
}
