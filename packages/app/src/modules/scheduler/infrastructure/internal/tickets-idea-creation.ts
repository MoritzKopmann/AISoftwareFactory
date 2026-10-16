import type { TicketsApi } from '../../../tickets/index.js';
import type { IdeaDraft } from '../../business/domain/types/idea-draft.js';
import type { RepositoryReference } from '../../business/domain/types/repository-reference.js';
import type { IdeaCreation } from '../../business/port/ticket/idea-creation.js';

export class TicketsIdeaCreation implements IdeaCreation {
  constructor(private readonly tickets: Pick<TicketsApi, 'createIdea'>) {}

  create(repository: RepositoryReference, idea: IdeaDraft): Promise<number> {
    return this.tickets.createIdea(repository, idea);
  }
}
