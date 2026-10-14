import type { ProjectsApi } from '../../../projects/index.js';
import type {
  RegisteredRepositories,
  RegisteredRepository,
} from '../../business/port/project/registered-repositories.js';

export class ProjectsRegisteredRepositories implements RegisteredRepositories {
  constructor(private readonly projects: Pick<ProjectsApi, 'list'>) {}

  async list(): Promise<ReadonlyArray<RegisteredRepository>> {
    return (await this.projects.list()).map(({ id, repository }) => ({
      projectId: id,
      repository,
    }));
  }
}
