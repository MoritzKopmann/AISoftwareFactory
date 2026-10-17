import type { Ticket } from '../types/ticket.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';

/** Numbers of tickets closed in `current` that were not closed in `previous`, or are new. */
export function closedTicketNumbers(
  previous: TicketSnapshot | undefined,
  current: TicketSnapshot,
): ReadonlyArray<number> {
  const previousStatuses = new Map(
    [...(previous?.openTickets ?? []), ...(previous?.recentlyClosedTickets ?? [])].map(
      (previousTicket) => [previousTicket.number, previousTicket.status],
    ),
  );
  return [...current.openTickets, ...current.recentlyClosedTickets]
    .filter((ticket) => isNewlyClosed(ticket, previousStatuses))
    .map((ticket) => ticket.number);
}

function isNewlyClosed(
  ticket: Ticket,
  previousStatuses: ReadonlyMap<number, Ticket['status']>,
): boolean {
  return ticket.status === 'closed' && previousStatuses.get(ticket.number) !== 'closed';
}
