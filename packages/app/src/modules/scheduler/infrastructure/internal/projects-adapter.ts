import type { ProjectsApi } from '../../../projects/index.js';
import type { ProjectPort, SchedulerProject } from '../../business/port/project/project-port.js';

export class ProjectsAdapter implements ProjectPort {
  constructor(private readonly projects: Pick<ProjectsApi, 'list'>) {}

  async find(projectId: string): Promise<SchedulerProject | undefined> {
    const project = (await this.projects.list()).find(({ id }) => id === projectId);
    return project === undefined
      ? undefined
      : { repository: project.repository, onboarded: project.contract.passed };
  }
}
