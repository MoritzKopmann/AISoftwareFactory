import type { StatusWrite } from '../types/status-write.js';
import type { Ticket } from '../types/ticket.js';
import { hasWrittenFlags } from './has-written-flags.js';

// True while the ticket still shows what GitHub may serve before it confirms the write:
// the old status, no status (mid-swap), a conflict that includes the new status, or the
// new status with the old flags.
export function isAwaitingConfirmation(ticket: Ticket, write: StatusWrite): boolean {
  return (
    ticket.status === write.from ||
    ticket.status === 'idea' ||
    (ticket.status === 'conflict' && ticket.conflictingStatuses.includes(write.to)) ||
    (ticket.status === write.to && !hasWrittenFlags(ticket, write))
  );
}
