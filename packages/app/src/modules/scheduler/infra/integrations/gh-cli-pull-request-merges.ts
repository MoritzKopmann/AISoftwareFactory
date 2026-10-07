import { GhCommandFailedError } from '../../../../shared/github/gh-command-failed-error.js';
import { runGhCommand } from '../../../../shared/github/run-gh-command.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import { PullRequestMergeFailedError } from '../../logic/errors/pull-request-merge-failed-error.js';
import type { PullRequestMerges } from '../../logic/ports/pull-request-merges.js';

export class GhCliPullRequestMerges implements PullRequestMerges {
  async merge(
    repository: RepositoryReference,
    pullRequestNumber: number,
    headCommit: string,
  ): Promise<void> {
    try {
      await runGhCommand(
        ['pr', 'merge', String(pullRequestNumber), '--rebase', '--match-head-commit', headCommit],
        { repository },
      );
    } catch (error) {
      if (!(error instanceof GhCommandFailedError)) {
        throw error;
      }
      if (/already merged/i.test(error.message)) {
        return;
      }
      throw new PullRequestMergeFailedError(error.message);
    }
  }
}
