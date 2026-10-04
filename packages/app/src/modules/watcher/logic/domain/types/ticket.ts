import type { ClosingPullRequest } from './closing-pull-request.js';
import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type Ticket = {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly body: string;
  readonly status: TicketStatus;
  readonly conflictingStatuses: ReadonlyArray<TicketStatus>;
  readonly hitl: boolean;
  readonly types: ReadonlyArray<TicketType>;
  readonly parent?: { readonly number: number; readonly title: string };
  readonly subIssueNumbers: ReadonlyArray<number>;
  readonly blockedBy: ReadonlyArray<{
    readonly repository: string;
    readonly number: number;
    readonly open: boolean;
  }>;
  readonly closingPullRequests: ReadonlyArray<ClosingPullRequest>;
  readonly updatedAt: string;
};
