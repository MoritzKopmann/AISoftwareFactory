import type {
  ProjectsModule,
  ProjectWithContract,
} from '../../../../src/modules/projects/index.js';

export class FakeProjectsList implements Pick<ProjectsModule, 'list'> {
  constructor(private readonly projects: ReadonlyArray<ProjectWithContract>) {}

  async list(): Promise<ReadonlyArray<ProjectWithContract>> {
    return this.projects;
  }
}
