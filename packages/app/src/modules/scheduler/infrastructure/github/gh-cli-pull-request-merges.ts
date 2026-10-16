import type { RepositoryReference } from '../../business/domain/types/repository-reference.js';
import { PullRequestMergeFailedError } from '../../business/errors/pull-request-merge-failed-error.js';
import type { PullRequestMerges } from '../../business/port/github/pull-request-merges.js';
import { runGhCommand } from '../../../../shared/process/run-gh-command.js';

export class GhCliPullRequestMerges implements PullRequestMerges {
  async merge(
    repository: RepositoryReference,
    pullRequestNumber: number,
    headCommit: string,
  ): Promise<void> {
    try {
      await runGhCommand(
        repository,
        ['pr', 'merge', String(pullRequestNumber), '--rebase', '--match-head-commit', headCommit],
        (message) => new PullRequestMergeFailedError(message),
      );
    } catch (error) {
      if (error instanceof PullRequestMergeFailedError && /already merged/i.test(error.message)) {
        return;
      }
      throw error;
    }
  }
}
