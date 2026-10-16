import { ConflictError } from '../../../../shared/errors.js';
import type { TicketsApi } from '../../../tickets/index.js';
import type { IdeaDraft } from '../../business/domain/types/idea-draft.js';
import type { RepositoryReference } from '../../business/domain/types/repository-reference.js';
import type { ReviewedTicket } from '../../business/domain/types/reviewed-ticket.js';
import type { SchedulableTicket } from '../../business/domain/types/schedulable-ticket.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import type { TicketPort } from '../../business/port/ticket/ticket-port.js';

export class TicketsAdapter implements TicketPort {
  constructor(
    private readonly tickets: Pick<
      TicketsApi,
      'ticket' | 'openTickets' | 'createIdea' | 'beginAnswer' | 'revertAnswer'
    >,
  ) {}

  async find(projectId: string, ticketNumber: number): Promise<SchedulableTicket | undefined> {
    const projectTicket = await this.tickets.ticket(projectId, ticketNumber);
    const ticket = projectTicket?.ticket;
    if (projectTicket === undefined || ticket === undefined) {
      return undefined;
    }
    const snapshotTakenAt =
      projectTicket.sync.state === 'pending' ? undefined : projectTicket.sync.snapshotTakenAt;
    return {
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      types: ticket.types,
      isLeaf: ticket.subIssueNumbers.length === 0,
      hasOpenBlocker: ticket.blockedBy.some((blocker) => blocker.open),
      subIssueNumbers: ticket.subIssueNumbers,
      ...(snapshotTakenAt === undefined ? {} : { snapshotTakenAt }),
    };
  }

  async list(projectId: string): Promise<ReadonlyArray<ReviewedTicket>> {
    return this.tickets.openTickets(projectId);
  }

  create(repository: RepositoryReference, idea: IdeaDraft): Promise<number> {
    return this.tickets.createIdea(repository, idea);
  }

  async begin(projectId: string, ticketNumber: number): Promise<void> {
    try {
      await this.tickets.beginAnswer(projectId, ticketNumber);
    } catch (error) {
      if (error instanceof ConflictError) {
        throw new RunNotAnswerableError(error.message);
      }
      throw error;
    }
  }

  revert(projectId: string, ticketNumber: number): Promise<void> {
    return this.tickets.revertAnswer(projectId, ticketNumber);
  }
}
