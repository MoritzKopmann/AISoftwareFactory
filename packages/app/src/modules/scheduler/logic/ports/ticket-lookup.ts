import type { SchedulableTicket } from '../domain/types/schedulable-ticket.js';

export interface TicketLookup {
  find(projectId: string, ticketNumber: number): Promise<SchedulableTicket | undefined>;
}
