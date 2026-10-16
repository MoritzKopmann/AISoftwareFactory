import type { RunTarget } from '../../business/domain/types/run-target.js';
import type { RunTargets } from '../../business/port/target/run-targets.js';
import type { ProjectsApi } from '../../../projects/index.js';

/** Finds where a run happens: the checkout and repository name of the registered project. */
export class ProjectsRunTargets implements RunTargets {
  constructor(private readonly projects: ProjectsApi) {}

  async find(projectId: string): Promise<RunTarget | undefined> {
    const project = (await this.projects.list()).find(({ id }) => id === projectId);
    return project === undefined
      ? undefined
      : { checkoutPath: project.checkoutPath, repositoryName: project.repository.name };
  }
}
