import type { Logger } from '../../../../shared/logger/create-logger.js';
import { findMergeablePullRequests } from '../domain/functions/find-mergeable-pull-requests.js';
import { PullRequestMergeFailedError } from '../errors/pull-request-merge-failed-error.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { PullRequestMerges } from '../ports/pull-request-merges.js';
import type { ReviewedTicketLookup } from '../ports/reviewed-ticket-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';

export type MergeApprovedPullRequestsDependencies = {
  readonly pullRequestMerges: PullRequestMerges;
  readonly runner: RunnerPort;
  readonly reviewedTicketLookup: ReviewedTicketLookup;
  readonly projectLookup: ProjectLookup;
  readonly logger: Logger;
};

export class MergeApprovedPullRequestsUseCase {
  private readonly pullRequestsBeingMerged = new Set<string>();

  constructor(private readonly dependencies: MergeApprovedPullRequestsDependencies) {}

  async execute(projectId: string): Promise<void> {
    const { pullRequestMerges, runner, reviewedTicketLookup, projectLookup, logger } =
      this.dependencies;

    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      return;
    }
    const tickets = await reviewedTicketLookup.list(projectId);
    const activeRun = await runner.activeRun(projectId);
    const mergeablePullRequests = findMergeablePullRequests(
      tickets,
      activeRun === undefined ? [] : [activeRun],
    );

    for (const { ticketNumber, pullRequestNumber, headCommit } of mergeablePullRequests) {
      const mergeKey = `${projectId}#${pullRequestNumber}`;
      if (this.pullRequestsBeingMerged.has(mergeKey)) {
        continue;
      }
      this.pullRequestsBeingMerged.add(mergeKey);
      try {
        await pullRequestMerges.merge(project.repository, pullRequestNumber, headCommit);
        logger.info(`Rebase-merged PR #${pullRequestNumber} for #${ticketNumber}`);
      } catch (error) {
        if (!(error instanceof PullRequestMergeFailedError)) {
          throw error;
        }
        logger.warn(
          `Merging PR #${pullRequestNumber} for #${ticketNumber} failed: ${error.message}`,
        );
      } finally {
        this.pullRequestsBeingMerged.delete(mergeKey);
      }
    }
  }
}
