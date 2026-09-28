import type { RepositoryReference } from '../domain/types/repository-reference.js';
import type { Ticket } from '../domain/types/ticket.js';
import type { TicketSnapshot } from '../domain/types/ticket-snapshot.js';

export interface TicketSource {
  snapshot(repository: RepositoryReference): Promise<TicketSnapshot>;
  ticket(repository: RepositoryReference, number: number): Promise<Ticket | undefined>;
}
