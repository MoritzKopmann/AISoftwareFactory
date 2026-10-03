import type { StatusWrite } from '../types/status-write.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';
import { isAwaitingConfirmation } from './is-awaiting-confirmation.js';

const statusWriteWindowMilliseconds = 60_000;

export function pruneStatusWrites(
  statusWrites: ReadonlyArray<StatusWrite>,
  snapshot: TicketSnapshot,
  now: string,
): ReadonlyArray<StatusWrite> {
  return statusWrites.filter((write) => {
    const ticket = snapshot.openTickets.find(
      (candidate) => candidate.number === write.ticketNumber,
    );
    return (
      ticket !== undefined &&
      ticket.status !== write.to &&
      isAwaitingConfirmation(ticket, write) &&
      Date.parse(now) - Date.parse(write.writtenAt) < statusWriteWindowMilliseconds
    );
  });
}
