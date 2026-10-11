import type { StatusWrite } from '../types/status-write.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';
import { isAwaitingConfirmation } from './is-awaiting-confirmation.js';

export function presentSnapshot(
  snapshot: TicketSnapshot,
  statusWrites: ReadonlyArray<StatusWrite>,
): TicketSnapshot {
  if (statusWrites.length === 0) {
    return snapshot;
  }
  return {
    ...snapshot,
    openTickets: snapshot.openTickets.map((ticket) => {
      const write = statusWrites.find((candidate) => candidate.ticketNumber === ticket.number);
      return write !== undefined && isAwaitingConfirmation(ticket, write)
        ? { ...ticket, status: write.to, conflictingStatuses: [] }
        : ticket;
    }),
  };
}
