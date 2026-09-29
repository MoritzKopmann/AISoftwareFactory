import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

export type SchedulableTicket = {
  readonly number: number;
  readonly status: TicketStatus;
  readonly hitl: boolean;
  readonly isLeaf: boolean;
  readonly hasOpenBlocker: boolean;
  readonly snapshotTakenAt?: string;
};
