import type { TicketsApi } from '../../../tickets/index.js';
import type { FindingIssue } from '../../business/domain/types/finding-issue.js';
import type { RepositoryReference } from '../../business/domain/types/repository-reference.js';
import type { TicketPort } from '../../business/port/ticket/ticket-port.js';

export class TicketsAdapter implements TicketPort {
  constructor(private readonly tickets: Pick<TicketsApi, 'createIdea'>) {}

  create(repository: RepositoryReference, issue: FindingIssue): Promise<number> {
    return this.tickets.createIdea(repository, issue);
  }
}
