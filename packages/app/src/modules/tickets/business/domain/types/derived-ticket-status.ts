import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

export type DerivedTicketStatus = {
  readonly status: TicketStatus;
  readonly conflictingStatuses: ReadonlyArray<TicketStatus>;
};
