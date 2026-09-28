import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Project } from '../domain/types/project.js';
import { PluginInstallFailedError } from '../errors/plugin-install-failed-error.js';
import { ProjectAlreadyAddedError } from '../errors/project-already-added-error.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { LabelSync } from '../ports/label-sync.js';
import type { PluginInstaller } from '../ports/plugin-installer.js';
import type { ProjectRepository } from '../ports/project-repository.js';
import type { RepositoryResolver } from '../ports/repository-resolver.js';

export type AddProjectDependencies = {
  readonly repositoryResolver: RepositoryResolver;
  readonly projectRepository: ProjectRepository;
  readonly labelSync: LabelSync;
  readonly pluginInstaller: PluginInstaller;
  readonly clock: Clock;
  readonly events: EventPublisher;
};

export class AddProjectUseCase {
  constructor(private readonly dependencies: AddProjectDependencies) {}

  async execute(checkoutPath: string): Promise<Project> {
    const { repositoryResolver, projectRepository, labelSync, pluginInstaller, clock, events } =
      this.dependencies;

    const repository = await repositoryResolver.resolve(checkoutPath);
    const id = `${repository.owner}/${repository.name}`;

    if ((await projectRepository.findById(id)) !== undefined) {
      throw new ProjectAlreadyAddedError(`${id} has already been added`);
    }

    await labelSync.sync(repository);

    const installResult = await pluginInstaller.install(checkoutPath);
    if (installResult.state === 'failed') {
      throw new PluginInstallFailedError(installResult.reason);
    }

    const project: Project = {
      id,
      repository,
      checkoutPath,
      addedAt: clock.now(),
    };

    await projectRepository.save(project);
    events.emit('project.added', {
      projectId: project.id,
      repository: project.repository,
      checkoutPath: project.checkoutPath,
    });

    return project;
  }
}
