import type { ProjectsApi } from '../../../projects/index.js';
import type {
  ProjectPort,
  RegisteredRepository,
} from '../../business/port/project/project-port.js';

export class ProjectsAdapter implements ProjectPort {
  constructor(private readonly projects: Pick<ProjectsApi, 'list'>) {}

  async list(): Promise<ReadonlyArray<RegisteredRepository>> {
    return (await this.projects.list()).map(({ id, repository }) => ({
      projectId: id,
      repository,
    }));
  }
}
