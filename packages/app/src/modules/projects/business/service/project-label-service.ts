import type { Logger } from '../../../../shared/logger/create-logger.js';
import { GitHubCliError } from '../errors/github-cli-error.js';
import type { LabelSync } from '../port/github/label-sync.js';
import type { ProjectRepository } from '../port/repository/project-repository.js';

export type ProjectLabelServiceDependencies = {
  readonly projectRepository: ProjectRepository;
  readonly labelSync: LabelSync;
  readonly logger: Logger;
};

export class ProjectLabelService {
  constructor(private readonly dependencies: ProjectLabelServiceDependencies) {}

  async syncLabels(): Promise<void> {
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
