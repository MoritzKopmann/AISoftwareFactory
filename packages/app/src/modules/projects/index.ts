import { Hono } from 'hono';
import { createProjectsRoutes } from './api/routes/create-projects-routes.js';
import type { Logger } from '../../shared/logger/create-logger.js';
import type { ContractPreflight } from './logic/ports/contract-preflight.js';
import {
  AddProjectUseCase,
  type AddProjectDependencies,
} from './logic/use-cases/add-project-use-case.js';
import type { ProjectWithContract } from './logic/domain/types/project-with-contract.js';
import { FindProjectUseCase } from './logic/use-cases/find-project-use-case.js';
import { ListProjectsUseCase } from './logic/use-cases/list-projects-use-case.js';
import { SyncProjectLabelsUseCase } from './logic/use-cases/sync-project-labels-use-case.js';

export type { Project } from './logic/domain/types/project.js';
export type { ContractPreflightReport } from './logic/domain/types/contract-preflight-report.js';
export type { ProjectWithContract } from './logic/domain/types/project-with-contract.js';

export type ProjectsModuleDependencies = AddProjectDependencies & {
  readonly contractPreflight: ContractPreflight;
  readonly logger: Logger;
};

export type ProjectsModule = {
  readonly routes: Hono;
  readonly list: () => Promise<ReadonlyArray<ProjectWithContract>>;
  readonly find: (projectId: string) => Promise<ProjectWithContract | undefined>;
  readonly start: () => Promise<void>;
};

export function createProjectsModule(dependencies: ProjectsModuleDependencies): ProjectsModule {
  const addProject = new AddProjectUseCase(dependencies);
  const listProjects = new ListProjectsUseCase(
    dependencies.projectRepository,
    dependencies.contractPreflight,
  );
  const findProject = new FindProjectUseCase(
    dependencies.projectRepository,
    dependencies.contractPreflight,
  );
  const syncProjectLabels = new SyncProjectLabelsUseCase(dependencies);

  return {
    routes: new Hono().route('/projects', createProjectsRoutes(listProjects, addProject)),
    list: () => listProjects.execute(),
    find: (projectId) => findProject.execute(projectId),
    start: () => syncProjectLabels.execute(),
  };
}
