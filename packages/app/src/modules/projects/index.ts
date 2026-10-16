import type { RepositoryResolver } from './business/port/github/repository-resolver.js';
import type { LabelSync } from './business/port/github/label-sync.js';
import type { ProjectRepository } from './business/port/repository/project-repository.js';
import { ProjectLabelService } from './business/service/project-label-service.js';
import { ProjectService } from './business/service/project-service.js';
import { GhCliLabelSync } from './infrastructure/github/gh-cli-label-sync.js';
import { GhCliRepositoryResolver } from './infrastructure/github/gh-cli-repository-resolver.js';
import { SkillsAdapter } from './infrastructure/internal/skills-adapter.js';
import { SqliteProjectRepository } from './infrastructure/repository/sqlite-project-repository.js';
import { createProjectsRoutes } from './presentation/api/projects-routes.js';
import { createProjectsSyncLabelsJob } from './presentation/cron/projects-sync-labels-job.js';
import { ProjectsFacade } from './presentation/internal/projects-facade.js';
import type {
  ProjectsModule,
  ProjectsModuleDependencies,
} from './presentation/internal/projects-module.js';
import type { SkillsApi } from '../skills/index.js';

export type { ProjectsApi } from './presentation/internal/projects-api.js';
export type {
  ProjectsModule,
  ProjectsModuleDependencies,
} from './presentation/internal/projects-module.js';
export type { ContractPreflightReportDto } from './presentation/dto/internal/contract-preflight-report-dto.js';
export type { ProjectDto } from './presentation/dto/internal/project-dto.js';

type ProjectsInfrastructure = {
  readonly repositoryResolver: RepositoryResolver;
  readonly projectRepository: ProjectRepository;
  readonly labelSync: LabelSync;
};

export function createProjectsModule(
  dependencies: ProjectsModuleDependencies & { readonly skills: SkillsApi },
  overrides: Partial<ProjectsInfrastructure> = {},
): ProjectsModule {
  const { repositoryResolver, projectRepository, labelSync }: ProjectsInfrastructure = {
    repositoryResolver: new GhCliRepositoryResolver(),
    projectRepository: new SqliteProjectRepository(dependencies.database),
    labelSync: new GhCliLabelSync(),
    ...overrides,
  };
  const projectService = new ProjectService({
    repositoryResolver,
    projectRepository,
    labelSync,
    skillPort: new SkillsAdapter(dependencies.skills),
    clock: dependencies.clock,
    events: dependencies.events,
  });
  const projectLabelService = new ProjectLabelService({
    projectRepository,
    labelSync,
    logger: dependencies.logger,
  });
  return {
    routes: createProjectsRoutes(projectService),
    jobs: { 'projects.sync-labels': createProjectsSyncLabelsJob(projectLabelService) },
    internal: new ProjectsFacade(projectService),
  };
}
