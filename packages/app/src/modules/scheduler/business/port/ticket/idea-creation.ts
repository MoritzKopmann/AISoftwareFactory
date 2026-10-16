import type { IdeaDraft } from '../../domain/types/idea-draft.js';
import type { RepositoryReference } from '../../domain/types/repository-reference.js';

export interface IdeaCreation {
  create(repository: RepositoryReference, idea: IdeaDraft): Promise<number>;
}
