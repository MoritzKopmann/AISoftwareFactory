import type { StatusWrite } from '../types/status-write.js';
import type { Ticket } from '../types/ticket.js';

// True while the ticket still shows what GitHub may serve before it confirms the write:
// the old status, no status (mid-swap), or a conflict that includes the new status.
export function isAwaitingConfirmation(ticket: Ticket, write: StatusWrite): boolean {
  return (
    ticket.status === write.from ||
    ticket.status === 'idea' ||
    (ticket.status === 'conflict' && ticket.conflictingStatuses.includes(write.to))
  );
}
