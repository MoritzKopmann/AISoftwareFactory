import type { ProjectsApi } from '../../../projects/index.js';
import type { FindingsProject, ProjectPort } from '../../business/port/project/project-port.js';

export class ProjectsAdapter implements ProjectPort {
  constructor(private readonly projects: Pick<ProjectsApi, 'list'>) {}

  async find(projectId: string): Promise<FindingsProject | undefined> {
    const project = (await this.projects.list()).find(({ id }) => id === projectId);
    return project === undefined ? undefined : { repository: project.repository };
  }
}
