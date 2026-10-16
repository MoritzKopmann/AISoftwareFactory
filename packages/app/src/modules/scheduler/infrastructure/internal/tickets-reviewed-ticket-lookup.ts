import type { TicketsApi } from '../../../tickets/index.js';
import type { ReviewedTicket } from '../../business/domain/types/reviewed-ticket.js';
import type { ReviewedTicketLookup } from '../../business/port/ticket/reviewed-ticket-lookup.js';

export class TicketsReviewedTicketLookup implements ReviewedTicketLookup {
  constructor(private readonly tickets: Pick<TicketsApi, 'openTickets'>) {}

  async list(projectId: string): Promise<ReadonlyArray<ReviewedTicket>> {
    return this.tickets.openTickets(projectId);
  }
}
