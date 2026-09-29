import { ticketStatusOrder } from '../../../../../shared/ticket-status/ticket-status-order.js';
import type { BoardView } from '../types/board-view.js';
import type { Ticket } from '../types/ticket.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';

export function arrangeBoard(snapshot: TicketSnapshot): BoardView {
  const tickets = [...snapshot.openTickets, ...snapshot.recentlyClosedTickets];
  return {
    rows: ticketStatusOrder.map((key) => {
      const rowTickets = tickets.filter((ticket) => ticket.status === key).sort(newestFirst);
      return {
        key,
        tickets: rowTickets,
        totalCount: key === 'closed' ? snapshot.closedTotalCount : rowTickets.length,
      };
    }),
  };
}

function newestFirst(left: Ticket, right: Ticket): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}
