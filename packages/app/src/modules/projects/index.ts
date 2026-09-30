import { Hono } from 'hono';
import { createProjectsRoutes } from './api/routes/create-projects-routes.js';
import type { ContractPreflight } from './logic/ports/contract-preflight.js';
import {
  AddProjectUseCase,
  type AddProjectDependencies,
} from './logic/use-cases/add-project-use-case.js';
import {
  ListProjectsUseCase,
  type ProjectWithContract,
} from './logic/use-cases/list-projects-use-case.js';

export type { Project } from './logic/domain/types/project.js';
export type { ContractPreflightReport } from './logic/domain/types/contract-preflight-report.js';
export type { ProjectWithContract } from './logic/use-cases/list-projects-use-case.js';

export type ProjectsModuleDependencies = AddProjectDependencies & {
  readonly contractPreflight: ContractPreflight;
};

export type ProjectsModule = {
  readonly routes: Hono;
  readonly list: () => Promise<ReadonlyArray<ProjectWithContract>>;
};

export function createProjectsModule(dependencies: ProjectsModuleDependencies): ProjectsModule {
  const addProject = new AddProjectUseCase(dependencies);
  const listProjects = new ListProjectsUseCase(
    dependencies.projectRepository,
    dependencies.contractPreflight,
  );

  return {
    routes: new Hono().route('/projects', createProjectsRoutes(listProjects, addProject)),
    list: () => listProjects.execute(),
  };
}
