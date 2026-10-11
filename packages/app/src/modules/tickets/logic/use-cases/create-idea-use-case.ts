import type { RepositoryReference } from '../domain/types/repository-reference.js';
import type { IdeaCreation } from '../ports/idea-creation.js';

export type CreateIdeaDependencies = {
  readonly ideaCreation: IdeaCreation;
  readonly refreshSnapshot: (repository: RepositoryReference) => Promise<void>;
};

export class CreateIdeaUseCase {
  constructor(private readonly dependencies: CreateIdeaDependencies) {}

  async execute(
    repository: RepositoryReference,
    idea: { readonly title: string; readonly body: string },
  ): Promise<number> {
    const createdNumber = await this.dependencies.ideaCreation.create(repository, idea);
    try {
      await this.dependencies.refreshSnapshot(repository);
    } catch {
      // The idea exists. The next timer poll shows it, so a failed refresh must not fail the call.
    }
    return createdNumber;
  }
}
