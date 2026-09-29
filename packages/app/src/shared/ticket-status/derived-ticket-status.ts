import type { TicketStatus } from './ticket-status.js';

export type DerivedTicketStatus = {
  readonly status: TicketStatus;
  readonly conflictingStatuses: ReadonlyArray<TicketStatus>;
};
