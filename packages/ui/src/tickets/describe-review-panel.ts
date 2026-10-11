import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

type ReviewPullRequest = {
  readonly label: string;
  readonly url: string;
  readonly state: string;
  readonly approved: boolean;
  readonly checks: TicketResponse['closingPullRequests'][number]['checks'];
  readonly mergeable: TicketResponse['closingPullRequests'][number]['mergeable'];
};

export type ReviewPanelDescription =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'shown'; readonly pullRequests: ReadonlyArray<ReviewPullRequest> };

export function describeReviewPanel(
  ticket: Pick<TicketResponse, 'status' | 'closingPullRequests'>,
): ReviewPanelDescription {
  if (ticket.status !== 'in-review' || ticket.closingPullRequests.length === 0) {
    return { kind: 'hidden' };
  }
  return {
    kind: 'shown',
    pullRequests: ticket.closingPullRequests.map((pullRequest) => ({
      label: `PR #${pullRequest.number}`,
      url: pullRequest.url,
      state: pullRequest.state.toLowerCase(),
      approved: pullRequest.approved,
      checks: pullRequest.checks,
      mergeable: pullRequest.mergeable,
    })),
  };
}
