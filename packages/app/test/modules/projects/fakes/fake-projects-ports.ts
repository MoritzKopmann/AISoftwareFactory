import type { EventPublisher } from '../../../../src/shared/bus/event-publisher.js';
import type { AisfEventMap } from '../../../../src/shared/bus/aisf-event-map.js';
import type { Project } from '../../../../src/modules/projects/logic/domain/project.js';
import type { Clock } from '../../../../src/modules/projects/logic/ports/clock.js';
import type { LabelSync } from '../../../../src/modules/projects/logic/ports/label-sync.js';
import type { ProjectRepository } from '../../../../src/modules/projects/logic/ports/project-repository.js';
import type {
  RepositoryReference,
  RepositoryResolver,
} from '../../../../src/modules/projects/logic/ports/repository-resolver.js';

export class FakeRepositoryResolver implements RepositoryResolver {
  resolveCalls: string[] = [];
  failure: Error | undefined;

  constructor(private reference: RepositoryReference) {}

  async resolve(checkoutPath: string): Promise<RepositoryReference> {
    this.resolveCalls.push(checkoutPath);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.reference;
  }
}

export class FakeProjectRepository implements ProjectRepository {
  private readonly projectsById = new Map<string, Project>();

  async findById(id: string): Promise<Project | undefined> {
    return this.projectsById.get(id);
  }

  async list(): Promise<ReadonlyArray<Project>> {
    return [...this.projectsById.values()];
  }

  async save(project: Project): Promise<void> {
    this.projectsById.set(project.id, project);
  }
}

export class FakeLabelSync implements LabelSync {
  syncCalls: RepositoryReference[] = [];
  failure: Error | undefined;

  async sync(repository: RepositoryReference): Promise<void> {
    this.syncCalls.push(repository);
    if (this.failure !== undefined) {
      throw this.failure;
    }
  }
}

export class FakeClock implements Clock {
  constructor(private currentTime: string) {}

  now(): string {
    return this.currentTime;
  }
}

export class FakeEventPublisher implements EventPublisher {
  readonly emittedEvents: Array<{ readonly name: keyof AisfEventMap; readonly payload: unknown }> =
    [];

  emit<Name extends keyof AisfEventMap>(name: Name, payload: AisfEventMap[Name]): void {
    this.emittedEvents.push({ name, payload });
  }
}
