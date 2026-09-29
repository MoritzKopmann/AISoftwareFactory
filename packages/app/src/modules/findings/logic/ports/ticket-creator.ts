import type { RepositoryReference } from '../domain/types/repository-reference.js';

export interface TicketCreator {
  create(
    repository: RepositoryReference,
    ticket: { readonly title: string; readonly body: string },
  ): Promise<number>;
}
