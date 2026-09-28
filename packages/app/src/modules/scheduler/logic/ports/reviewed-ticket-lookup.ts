import type { ReviewedTicket } from '../domain/types/reviewed-ticket.js';

export interface ReviewedTicketLookup {
  list(projectId: string): Promise<ReadonlyArray<ReviewedTicket>>;
}
