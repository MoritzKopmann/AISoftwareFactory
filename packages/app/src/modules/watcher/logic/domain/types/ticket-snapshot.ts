import type { Ticket } from './ticket.js';

export type TicketSnapshot = {
  readonly takenAt: string;
  readonly openTickets: ReadonlyArray<Ticket>;
  readonly recentlyClosedTickets: ReadonlyArray<Ticket>;
  readonly closedTotalCount: number;
};
