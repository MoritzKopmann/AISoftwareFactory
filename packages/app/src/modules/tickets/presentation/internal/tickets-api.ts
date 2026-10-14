import type { IdeaDto } from '../dto/internal/idea-dto.js';
import type { ProjectTicketDto } from '../dto/internal/project-ticket-dto.js';
import type { RepositoryReferenceDto } from '../dto/internal/repository-reference-dto.js';
import type { TicketDto } from '../dto/internal/ticket-dto.js';

/**
 * What other modules may ask of tickets. Only shared error kinds are thrown: `beginAnswer`
 * throws a `ConflictError` when the project is unknown or the ticket is not waiting.
 */
export interface TicketsApi {
  openTickets(projectId: string): ReadonlyArray<TicketDto>;
  /** Resolves `undefined` when the project is unwatched or the ticket does not exist. */
  ticket(projectId: string, number: number): Promise<ProjectTicketDto | undefined>;
  beginAnswer(projectId: string, ticketNumber: number): Promise<void>;
  revertAnswer(projectId: string, ticketNumber: number): Promise<void>;
  /** Returns the number of the new idea. */
  createIdea(repository: RepositoryReferenceDto, idea: IdeaDto): Promise<number>;
}
