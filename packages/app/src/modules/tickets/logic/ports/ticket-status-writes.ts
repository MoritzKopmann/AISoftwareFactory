import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';
import type { TicketLiveState } from '../domain/types/ticket-live-state.js';
import type { RepositoryReference } from '../domain/types/repository-reference.js';

export interface TicketStatusWrites {
  readState(repository: RepositoryReference, ticketNumber: number): Promise<TicketLiveState>;
  setStatus(repository: RepositoryReference, ticketNumber: number, to: TicketStatus): Promise<void>;
  setSecondaryState(
    repository: RepositoryReference,
    ticketNumber: number,
    state: 'waiting' | 'stuck',
    on: boolean,
  ): Promise<void>;
  comment(repository: RepositoryReference, ticketNumber: number, body: string): Promise<void>;
}
