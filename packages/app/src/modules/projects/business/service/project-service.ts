import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { ContractPreflight } from '../port/contract/contract-preflight.js';
import type { Project } from '../domain/types/project.js';
import type { ProjectWithContract } from '../domain/types/project-with-contract.js';
import { PluginInstallFailedError } from '../errors/plugin-install-failed-error.js';
import { ProjectAlreadyAddedError } from '../errors/project-already-added-error.js';
import type { LabelSync } from '../port/github/label-sync.js';
import type { RepositoryResolver } from '../port/github/repository-resolver.js';
import type { PluginInstaller } from '../port/plugin/plugin-installer.js';
import type { ProjectRepository } from '../port/repository/project-repository.js';

export type ProjectServiceDependencies = {
  readonly repositoryResolver: RepositoryResolver;
  readonly projectRepository: ProjectRepository;
  readonly labelSync: LabelSync;
  readonly pluginInstaller: PluginInstaller;
  readonly contractPreflight: ContractPreflight;
  readonly clock: Clock;
  readonly events: EventPublisher;
};

export class ProjectService {
  constructor(private readonly dependencies: ProjectServiceDependencies) {}

  async add(checkoutPath: string): Promise<Project> {
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

  async list(): Promise<ReadonlyArray<ProjectWithContract>> {
    const { projectRepository, contractPreflight } = this.dependencies;
    const projects = await projectRepository.list();
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        contract: await contractPreflight.check(project.checkoutPath),
      })),
    );
  }
}
