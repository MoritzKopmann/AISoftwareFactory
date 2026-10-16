import type { Logger } from '../../../../shared/logger/create-logger.js';
import { findMergeablePullRequests } from '../domain/functions/find-mergeable-pull-requests.js';
import { PullRequestMergeFailedError } from '../errors/pull-request-merge-failed-error.js';
import type { PullRequestMerges } from '../port/github/pull-request-merges.js';
import type { ProjectPort } from '../port/project/project-port.js';
import type { RunPort } from '../port/run/run-port.js';
import type { TicketPort } from '../port/ticket/ticket-port.js';

export type MergeServiceDependencies = {
  readonly pullRequestMerges: PullRequestMerges;
  readonly runPort: Pick<RunPort, 'activeRuns'>;
  readonly ticketPort: Pick<TicketPort, 'list'>;
  readonly projectPort: ProjectPort;
  readonly logger: Logger;
};

export class MergeService {
  private readonly pullRequestsBeingMerged = new Set<string>();

  constructor(private readonly dependencies: MergeServiceDependencies) {}

  async mergeApproved(projectId: string): Promise<void> {
    const { pullRequestMerges, runPort, ticketPort, projectPort, logger } = this.dependencies;

    const project = await projectPort.find(projectId);
    if (project === undefined) {
      return;
    }
    const tickets = await ticketPort.list(projectId);
    const activeRuns = await runPort.activeRuns(projectId);
    const mergeablePullRequests = findMergeablePullRequests(
      tickets,
      activeRuns.map(({ run }) => run),
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
