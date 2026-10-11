import type { RepositoryReference } from '../domain/types/repository-reference.js';

export interface IdeaCreation {
  create(
    repository: RepositoryReference,
    idea: { readonly title: string; readonly body: string },
  ): Promise<number>;
}
