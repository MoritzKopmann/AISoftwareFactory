import type { StatusWrite } from '../types/status-write.js';
import type { Ticket } from '../types/ticket.js';

export function hasWrittenFlags(ticket: Ticket, write: StatusWrite): boolean {
  return ticket.waiting === write.waiting && ticket.stuck === write.stuck;
}
