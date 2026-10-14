import type { ProjectBoard } from '../../../business/domain/types/project-board.js';
import type { ProjectTicket } from '../../../business/domain/types/project-ticket.js';
import type { RepositoryReference } from '../../../business/domain/types/repository-reference.js';
import type { SyncStatus } from '../../../business/domain/types/sync-status.js';
import type { Ticket } from '../../../business/domain/types/ticket.js';
import type {
  ProjectBoardResponse,
  ProjectTicketResponse,
  SyncStatusResponse,
  TicketResponse,
} from '../api/tickets-schemas.js';
import type { ProjectTicketDto } from '../internal/project-ticket-dto.js';
import type { RepositoryReferenceDto } from '../internal/repository-reference-dto.js';
import type { SyncStatusDto } from '../internal/sync-status-dto.js';
import type { TicketDto } from '../internal/ticket-dto.js';

export function toTicketResponse(ticket: Ticket): TicketResponse {
  return {
    number: ticket.number,
    title: ticket.title,
    url: ticket.url,
    body: ticket.body,
    status: ticket.status,
    conflictingStatuses: [...ticket.conflictingStatuses],
    hitl: ticket.hitl,
    waiting: ticket.waiting,
    stuck: ticket.stuck,
    types: [...ticket.types],
    ...(ticket.parent === undefined
      ? {}
      : { parent: { number: ticket.parent.number, title: ticket.parent.title } }),
    subIssueNumbers: [...ticket.subIssueNumbers],
    blockedBy: ticket.blockedBy.map(({ repository, number, open }) => ({
      repository,
      number,
      open,
    })),
    closingPullRequests: ticket.closingPullRequests.map((pullRequest) => ({ ...pullRequest })),
    updatedAt: ticket.updatedAt,
  };
}

export function toSyncStatusResponse(sync: SyncStatus): SyncStatusResponse {
  return { ...sync };
}

export function toProjectTicketResponse(projectTicket: ProjectTicket): ProjectTicketResponse {
  return {
    projectId: projectTicket.projectId,
    sync: toSyncStatusResponse(projectTicket.sync),
    ...(projectTicket.ticket === undefined
      ? {}
      : { ticket: toTicketResponse(projectTicket.ticket) }),
  };
}

export function toProjectBoardResponse(projectBoard: ProjectBoard): ProjectBoardResponse {
  return {
    projectId: projectBoard.projectId,
    sync: toSyncStatusResponse(projectBoard.sync),
    ...(projectBoard.board === undefined
      ? {}
      : {
          board: {
            rows: projectBoard.board.rows.map((row) => ({
              key: row.key,
              tickets: row.tickets.map(toTicketResponse),
              totalCount: row.totalCount,
            })),
          },
        }),
    runningTicketNumbers: [...projectBoard.runningTicketNumbers],
  };
}

export function toSyncStatusDto(sync: SyncStatus): SyncStatusDto {
  return { ...sync };
}

export function toTicketDto(ticket: Ticket): TicketDto {
  return {
    number: ticket.number,
    title: ticket.title,
    url: ticket.url,
    body: ticket.body,
    status: ticket.status,
    conflictingStatuses: [...ticket.conflictingStatuses],
    hitl: ticket.hitl,
    waiting: ticket.waiting,
    stuck: ticket.stuck,
    types: [...ticket.types],
    ...(ticket.parent === undefined
      ? {}
      : { parent: { number: ticket.parent.number, title: ticket.parent.title } }),
    subIssueNumbers: [...ticket.subIssueNumbers],
    blockedBy: ticket.blockedBy.map(({ repository, number, open }) => ({
      repository,
      number,
      open,
    })),
    closingPullRequests: ticket.closingPullRequests.map((pullRequest) => ({ ...pullRequest })),
    updatedAt: ticket.updatedAt,
  };
}

export function toProjectTicketDto(projectTicket: ProjectTicket): ProjectTicketDto {
  return {
    projectId: projectTicket.projectId,
    sync: toSyncStatusDto(projectTicket.sync),
    ...(projectTicket.ticket === undefined ? {} : { ticket: toTicketDto(projectTicket.ticket) }),
  };
}

export function toRepositoryReference(repository: RepositoryReferenceDto): RepositoryReference {
  return { owner: repository.owner, name: repository.name };
}
