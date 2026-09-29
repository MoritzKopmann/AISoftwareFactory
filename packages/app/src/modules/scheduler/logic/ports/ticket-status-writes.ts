import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';
import type { RepositoryReference } from '../domain/types/repository-reference.js';

export interface TicketStatusWrites {
  readStatus(repository: RepositoryReference, ticketNumber: number): Promise<TicketStatus>;
  setStatus(repository: RepositoryReference, ticketNumber: number, to: TicketStatus): Promise<void>;
  comment(repository: RepositoryReference, ticketNumber: number, body: string): Promise<void>;
}
