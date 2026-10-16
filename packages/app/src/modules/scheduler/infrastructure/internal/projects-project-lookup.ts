import type { ProjectsApi } from '../../../projects/index.js';
import type {
  ProjectLookup,
  SchedulerProject,
} from '../../business/port/project/project-lookup.js';

export class ProjectsProjectLookup implements ProjectLookup {
  constructor(private readonly projects: Pick<ProjectsApi, 'list'>) {}

  async find(projectId: string): Promise<SchedulerProject | undefined> {
    const project = (await this.projects.list()).find(({ id }) => id === projectId);
    return project === undefined
      ? undefined
      : { repository: project.repository, onboarded: project.contract.passed };
  }
}
