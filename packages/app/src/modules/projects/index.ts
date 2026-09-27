import type { Project } from './logic/domain/project.js';
import { CheckoutNotARepositoryError } from './logic/errors/checkout-not-a-repository-error.js';
import { GitHubCliError } from './logic/errors/github-cli-error.js';
import { PluginInstallFailedError } from './logic/errors/plugin-install-failed-error.js';
import { ProjectAlreadyAddedError } from './logic/errors/project-already-added-error.js';
import {
  AddProjectUseCase,
  type AddProjectDependencies,
} from './logic/use-cases/add-project-use-case.js';
import { ListProjectsUseCase } from './logic/use-cases/list-projects-use-case.js';

export type { Project } from './logic/domain/project.js';
export {
  CheckoutNotARepositoryError,
  GitHubCliError,
  PluginInstallFailedError,
  ProjectAlreadyAddedError,
};

export type ProjectsModuleDependencies = AddProjectDependencies;

export type ProjectsModule = {
  readonly add: (checkoutPath: string) => Promise<Project>;
  readonly list: () => Promise<ReadonlyArray<Project>>;
};

export function createProjectsModule(dependencies: ProjectsModuleDependencies): ProjectsModule {
  const addProject = new AddProjectUseCase(dependencies);
  const listProjects = new ListProjectsUseCase(dependencies.projectRepository);

  return {
    add: (checkoutPath) => addProject.execute(checkoutPath),
    list: () => listProjects.execute(),
  };
}
