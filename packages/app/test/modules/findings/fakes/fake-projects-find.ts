import type {
  ProjectsModule,
  ProjectWithContract,
} from '../../../../src/modules/projects/index.js';

export class FakeProjectsFind implements Pick<ProjectsModule, 'find'> {
  constructor(private readonly projects: ReadonlyArray<ProjectWithContract>) {}

  async find(projectId: string): Promise<ProjectWithContract | undefined> {
    return this.projects.find(({ id }) => id === projectId);
  }
}
