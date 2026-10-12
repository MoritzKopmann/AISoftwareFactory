import type {
  RegisteredRepositories,
  RegisteredRepository,
} from '../../logic/ports/registered-repositories.js';
import type { ProjectsModule } from '../../../projects/index.js';

export class ProjectsModuleRegisteredRepositories implements RegisteredRepositories {
  constructor(private readonly projects: Pick<ProjectsModule, 'list'>) {}

  async list(): Promise<ReadonlyArray<RegisteredRepository>> {
    const projects = await this.projects.list();
    return projects.map(({ id, repository }) => ({ projectId: id, repository }));
  }
}
