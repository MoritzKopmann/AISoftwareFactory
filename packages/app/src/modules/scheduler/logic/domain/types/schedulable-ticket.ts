import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type SchedulableTicket = {
  readonly number: number;
  readonly status: TicketStatus;
  readonly hitl: boolean;
  readonly types: ReadonlyArray<TicketType>;
  readonly isLeaf: boolean;
  readonly hasOpenBlocker: boolean;
  readonly snapshotTakenAt?: string;
};
