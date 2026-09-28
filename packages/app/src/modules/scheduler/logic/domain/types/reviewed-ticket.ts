import type { ClosingPullRequest } from './closing-pull-request.js';
import type { TicketStatus } from './ticket-status.js';

export type ReviewedTicket = {
  readonly number: number;
  readonly status: TicketStatus;
  readonly closingPullRequests: ReadonlyArray<ClosingPullRequest>;
};
