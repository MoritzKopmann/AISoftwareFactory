import type { RunTarget } from '../../business/domain/types/run-target.js';
import type { ProjectPort } from '../../business/port/project/project-port.js';
import type { ProjectsApi } from '../../../projects/index.js';

/** Finds where a run happens: the checkout and repository name of the registered project. */
export class ProjectsAdapter implements ProjectPort {
  constructor(private readonly projects: Pick<ProjectsApi, 'list'>) {}

  async find(projectId: string): Promise<RunTarget | undefined> {
    const project = (await this.projects.list()).find(({ id }) => id === projectId);
    return project === undefined
      ? undefined
      : { checkoutPath: project.checkoutPath, repositoryName: project.repository.name };
  }
}
