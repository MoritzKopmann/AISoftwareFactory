import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Project } from '../domain/types/project.js';
import type { ProjectWithContract } from '../domain/types/project-with-contract.js';
import { PluginInstallFailedError } from '../errors/plugin-install-failed-error.js';
import { ProjectAlreadyAddedError } from '../errors/project-already-added-error.js';
import { ProjectNotFoundError } from '../errors/project-not-found-error.js';
import type { CheckoutFetcher } from '../port/checkout/checkout-fetcher.js';
import type { LabelSync } from '../port/github/label-sync.js';
import type { RepositoryResolver } from '../port/github/repository-resolver.js';
import type { SkillPort } from '../port/skill/skill-port.js';
import type { ProjectRepository } from '../port/repository/project-repository.js';

export type ProjectServiceDependencies = {
  readonly repositoryResolver: RepositoryResolver;
  readonly projectRepository: ProjectRepository;
  readonly labelSync: LabelSync;
  readonly skillPort: SkillPort;
  readonly checkoutFetcher: CheckoutFetcher;
  readonly clock: Clock;
  readonly events: EventPublisher;
};

export class ProjectService {
  constructor(private readonly dependencies: ProjectServiceDependencies) {}

  async add(checkoutPath: string): Promise<Project> {
    const {
      repositoryResolver,
      projectRepository,
      labelSync,
      skillPort,
      checkoutFetcher,
      clock,
      events,
    } = this.dependencies;

    const repository = await repositoryResolver.resolve(checkoutPath);
    const id = `${repository.owner}/${repository.name}`;

    if ((await projectRepository.findById(id)) !== undefined) {
      throw new ProjectAlreadyAddedError(`${id} has already been added`);
    }

    await labelSync.sync(repository);

    const installResult = await skillPort.install(checkoutPath);
    if (installResult.state === 'failed') {
      throw new PluginInstallFailedError(installResult.reason);
    }

    await checkoutFetcher.fetch(checkoutPath);

    const project: Project = {
      id,
      repository,
      checkoutPath,
      addedAt: clock.now(),
      paused: false,
    };

    await projectRepository.save(project);
    events.emit('project.added', {
      projectId: project.id,
      repository: project.repository,
      checkoutPath: project.checkoutPath,
    });

    return project;
  }

  async refreshCheckout(projectId: string): Promise<void> {
    const { projectRepository, checkoutFetcher, events } = this.dependencies;
    const project = await projectRepository.findById(projectId);
    if (project === undefined) {
      return;
    }

    await checkoutFetcher.fetch(project.checkoutPath);
    events.emit('project.checkout-refreshed', { projectId });
  }

  async list(): Promise<ReadonlyArray<ProjectWithContract>> {
    const { projectRepository, skillPort } = this.dependencies;
    const projects = await projectRepository.list();
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        contract: await skillPort.check(project.checkoutPath),
      })),
    );
  }

  async setPaused(id: string, paused: boolean): Promise<ProjectWithContract> {
    const { projectRepository, skillPort } = this.dependencies;
    const project = await projectRepository.findById(id);
    if (project === undefined) {
      throw new ProjectNotFoundError(`${id} is not a registered project`);
    }

    await projectRepository.setPaused(id, paused);
    return { ...project, paused, contract: await skillPort.check(project.checkoutPath) };
  }
}
