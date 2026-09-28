import type { Ticket } from './ticket.js';
import type { TicketStatus } from './ticket-status.js';

export type BoardRow = {
  readonly key: TicketStatus;
  readonly tickets: ReadonlyArray<Ticket>;
  readonly totalCount: number;
};
