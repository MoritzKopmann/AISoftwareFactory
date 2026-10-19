import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type OpenPullRequest = {
  readonly approved: boolean;
  readonly mergeable: 'mergeable' | 'conflicting' | 'unknown';
  readonly lastReviewActivityAt?: string;
};

export type SchedulableTicket = {
  readonly number: number;
  readonly title: string;
  readonly status: TicketStatus;
  readonly types: ReadonlyArray<TicketType>;
  readonly isLeaf: boolean;
  readonly hasOpenBlocker: boolean;
  readonly stuck: boolean;
  readonly waiting: boolean;
  readonly syncFailed: boolean;
  readonly subIssueNumbers: ReadonlyArray<number>;
  readonly snapshotTakenAt?: string;
  readonly openPullRequest?: OpenPullRequest;
};
