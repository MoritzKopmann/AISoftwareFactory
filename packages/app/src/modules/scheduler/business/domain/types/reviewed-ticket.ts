import type { ClosingPullRequest } from './closing-pull-request.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';
import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

export type ReviewedTicket = {
  readonly number: number;
  readonly status: TicketStatus;
  readonly types: ReadonlyArray<TicketType>;
  readonly closingPullRequests: ReadonlyArray<ClosingPullRequest>;
};
