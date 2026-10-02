import type { Logger } from '../../../../shared/logger/create-logger.js';
import { GitHubCliError } from '../errors/github-cli-error.js';
import type { LabelSync } from '../ports/label-sync.js';
import type { ProjectRepository } from '../ports/project-repository.js';

export type SyncProjectLabelsDependencies = {
  readonly projectRepository: ProjectRepository;
  readonly labelSync: LabelSync;
  readonly logger: Logger;
};

export class SyncProjectLabelsUseCase {
  constructor(private readonly dependencies: SyncProjectLabelsDependencies) {}

  async execute(): Promise<void> {
    const { projectRepository, labelSync, logger } = this.dependencies;

    for (const project of await projectRepository.list()) {
      try {
        await labelSync.sync(project.repository);
      } catch (error) {
        if (!(error instanceof GitHubCliError)) {
          throw error;
        }
        logger.warn(`Syncing the labels of ${project.id} failed: ${error.message}`);
      }
    }
  }
}
