import type { IdeaService } from '../../business/service/idea-service.js';
import type { TicketReadService } from '../../business/service/ticket-read-service.js';
import type { TicketStatusService } from '../../business/service/ticket-status-service.js';
import type { IdeaDto } from '../dto/internal/idea-dto.js';
import type { ProjectTicketDto } from '../dto/internal/project-ticket-dto.js';
import type { RepositoryReferenceDto } from '../dto/internal/repository-reference-dto.js';
import type { TicketDto } from '../dto/internal/ticket-dto.js';
import {
  toIdeaDraft,
  toProjectTicketDto,
  toRepositoryReference,
  toTicketDto,
} from '../dto/mapper/ticket-mapper.js';
import type { TicketsApi } from './tickets-api.js';

export type TicketsFacadeServices = {
  readonly ticketReadService: TicketReadService;
  readonly ticketStatusService: TicketStatusService;
  readonly ideaService: IdeaService;
};

export class TicketsFacade implements TicketsApi {
  constructor(private readonly services: TicketsFacadeServices) {}

  openTickets(projectId: string): ReadonlyArray<TicketDto> {
    return this.services.ticketReadService.readOpenTickets(projectId).map(toTicketDto);
  }

  async ticket(projectId: string, number: number): Promise<ProjectTicketDto | undefined> {
    const projectTicket = await this.services.ticketReadService.readTicket(projectId, number);
    return projectTicket === undefined ? undefined : toProjectTicketDto(projectTicket);
  }

  beginAnswer(projectId: string, ticketNumber: number): Promise<void> {
    return this.services.ticketStatusService.beginAnswer(projectId, ticketNumber);
  }

  revertAnswer(projectId: string, ticketNumber: number): Promise<void> {
    return this.services.ticketStatusService.revertAnswer(projectId, ticketNumber);
  }

  createIdea(repository: RepositoryReferenceDto, idea: IdeaDto): Promise<number> {
    return this.services.ideaService.create(toRepositoryReference(repository), toIdeaDraft(idea));
  }
}
