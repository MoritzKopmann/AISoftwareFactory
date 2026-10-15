import type { TicketsApi } from '../../../tickets/index.js';
import type { RepositoryReference } from '../../business/domain/types/repository-reference.js';
import type { TicketCreator } from '../../business/port/ticket/ticket-creator.js';

export class TicketsTicketCreator implements TicketCreator {
  constructor(private readonly tickets: Pick<TicketsApi, 'createIdea'>) {}

  create(
    repository: RepositoryReference,
    ticket: { readonly title: string; readonly body: string },
  ): Promise<number> {
    return this.tickets.createIdea(repository, ticket);
  }
}
