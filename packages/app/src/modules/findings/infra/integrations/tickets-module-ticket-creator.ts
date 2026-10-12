import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import type { TicketCreator } from '../../logic/ports/ticket-creator.js';
import type { TicketsModule } from '../../../tickets/index.js';

export class TicketsModuleTicketCreator implements TicketCreator {
  constructor(private readonly tickets: Pick<TicketsModule, 'createIdea'>) {}

  create(
    repository: RepositoryReference,
    ticket: { readonly title: string; readonly body: string },
  ): Promise<number> {
    return this.tickets.createIdea(repository, ticket);
  }
}
