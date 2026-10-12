import type { FindingsProject, ProjectLookup } from '../../logic/ports/project-lookup.js';
import type { ProjectsModule } from '../../../projects/index.js';

export class ProjectsModuleProjectLookup implements ProjectLookup {
  constructor(private readonly projects: Pick<ProjectsModule, 'find'>) {}

  async find(projectId: string): Promise<FindingsProject | undefined> {
    const project = await this.projects.find(projectId);
    return project === undefined ? undefined : { repository: project.repository };
  }
}
