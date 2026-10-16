import type { IdeaDraft } from '../../domain/types/idea-draft.js';
import type { RepositoryReference } from '../../domain/types/repository-reference.js';
import type { ReviewedTicket } from '../../domain/types/reviewed-ticket.js';
import type { SchedulableTicket } from '../../domain/types/schedulable-ticket.js';

export interface TicketPort {
  find(projectId: string, ticketNumber: number): Promise<SchedulableTicket | undefined>;
  list(projectId: string): Promise<ReadonlyArray<ReviewedTicket>>;
  create(repository: RepositoryReference, idea: IdeaDraft): Promise<number>;
  begin(projectId: string, ticketNumber: number): Promise<void>;
  revert(projectId: string, ticketNumber: number): Promise<void>;
}
