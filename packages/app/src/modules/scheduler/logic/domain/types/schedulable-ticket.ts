import type { TicketStatus } from './ticket-status.js';

export type SchedulableTicket = {
  readonly number: number;
  readonly status: TicketStatus;
  readonly hitl: boolean;
  readonly isLeaf: boolean;
  readonly hasOpenBlocker: boolean;
  readonly snapshotTakenAt?: string;
};
