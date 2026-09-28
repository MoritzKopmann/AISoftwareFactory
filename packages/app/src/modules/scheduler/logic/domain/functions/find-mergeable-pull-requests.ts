import type { ClosingPullRequest } from '../types/closing-pull-request.js';
import type { MergeablePullRequest } from '../types/mergeable-pull-request.js';
import type { ReviewedTicket } from '../types/reviewed-ticket.js';

export function findMergeablePullRequests(
  tickets: ReadonlyArray<ReviewedTicket>,
  activeRuns: ReadonlyArray<{ readonly ticketNumber: number }>,
): ReadonlyArray<MergeablePullRequest> {
  const activeTicketNumbers = new Set(activeRuns.map((run) => run.ticketNumber));
  return tickets.flatMap((ticket) => {
    if (ticket.status !== 'in-review' || activeTicketNumbers.has(ticket.number)) {
      return [];
    }
    const openPullRequests = ticket.closingPullRequests.filter(
      (pullRequest) => pullRequest.state === 'OPEN',
    );
    const [pullRequest] = openPullRequests;
    if (pullRequest === undefined || openPullRequests.length > 1 || !canMerge(pullRequest)) {
      return [];
    }
    return [
      {
        ticketNumber: ticket.number,
        pullRequestNumber: pullRequest.number,
        headCommit: pullRequest.headCommit,
      },
    ];
  });
}

function canMerge(pullRequest: ClosingPullRequest): boolean {
  return (
    pullRequest.reviewDecision === 'APPROVED' &&
    (pullRequest.checks === 'passing' || pullRequest.checks === 'none') &&
    pullRequest.mergeable === 'mergeable' &&
    pullRequest.canBeRebased
  );
}
