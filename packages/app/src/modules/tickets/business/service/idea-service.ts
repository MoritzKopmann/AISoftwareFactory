import type { IdeaDraft } from '../domain/types/idea-draft.js';
import type { RepositoryReference } from '../domain/types/repository-reference.js';
import type { IdeaCreation } from '../port/github/idea-creation.js';
import type { RepositoryWatchService } from './repository-watch-service.js';

export type IdeaServiceDependencies = {
  readonly ideaCreation: IdeaCreation;
  readonly repositoryWatchService: Pick<RepositoryWatchService, 'refresh'>;
};

export class IdeaService {
  constructor(private readonly dependencies: IdeaServiceDependencies) {}

  async create(repository: RepositoryReference, idea: IdeaDraft): Promise<number> {
    const createdNumber = await this.dependencies.ideaCreation.create(repository, idea);
    // The poll loop reports its own failures, so a refresh never rejects.
    await this.dependencies.repositoryWatchService.refresh(repository);
    return createdNumber;
  }
}
