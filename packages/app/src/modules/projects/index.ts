import type { Project } from './logic/domain/project.js';
import { CheckoutNotARepositoryError } from './logic/errors/checkout-not-a-repository-error.js';
import { GitHubCliError } from './logic/errors/github-cli-error.js';
import { PluginInstallFailedError } from './logic/errors/plugin-install-failed-error.js';
import { ProjectAlreadyAddedError } from './logic/errors/project-already-added-error.js';
import type { ContractPreflight } from './logic/ports/contract-preflight.js';
import {
  AddProjectUseCase,
  type AddProjectDependencies,
} from './logic/use-cases/add-project-use-case.js';
import {
  ListProjectsUseCase,
  type ProjectWithContract,
} from './logic/use-cases/list-projects-use-case.js';

export type { Project } from './logic/domain/project.js';
export type { ContractPreflightReport } from './logic/domain/contract-preflight-report.js';
export type { ProjectWithContract } from './logic/use-cases/list-projects-use-case.js';
export {
  CheckoutNotARepositoryError,
  GitHubCliError,
  PluginInstallFailedError,
  ProjectAlreadyAddedError,
};

export type ProjectsModuleDependencies = AddProjectDependencies & {
  readonly contractPreflight: ContractPreflight;
};

export type ProjectsModule = {
  readonly add: (checkoutPath: string) => Promise<Project>;
  readonly list: () => Promise<ReadonlyArray<ProjectWithContract>>;
};

export function createProjectsModule(dependencies: ProjectsModuleDependencies): ProjectsModule {
  const addProject = new AddProjectUseCase(dependencies);
  const listProjects = new ListProjectsUseCase(
    dependencies.projectRepository,
    dependencies.contractPreflight,
  );

  return {
    add: (checkoutPath) => addProject.execute(checkoutPath),
    list: () => listProjects.execute(),
  };
}
