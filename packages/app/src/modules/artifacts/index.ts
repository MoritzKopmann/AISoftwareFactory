import type { ArtifactFiles } from './business/port/file/artifact-files.js';
import type { ArtifactRepository } from './business/port/repository/artifact-repository.js';
import { ArtifactService } from './business/service/artifact-service.js';
import { PageService } from './business/service/page-service.js';
import { FileSystemArtifactFiles } from './infrastructure/file/file-system-artifact-files.js';
import { AgentRunsAdapter } from './infrastructure/internal/agent-runs-adapter.js';
import { SchedulerAdapter } from './infrastructure/internal/scheduler-adapter.js';
import { SqliteArtifactRepository } from './infrastructure/repository/sqlite-artifact-repository.js';
import { createArtifactsRoutes } from './presentation/api/artifacts-routes.js';
import { ArtifactsFacade } from './presentation/internal/artifacts-facade.js';
import type {
  ArtifactsModule,
  ArtifactsModuleDependencies,
} from './presentation/internal/artifacts-module.js';
import { createShowArtifactTool } from './presentation/tool/create-show-artifact-tool.js';
import type { AgentRunsApi } from '../agent-runs/index.js';
import type { SchedulerApi } from '../scheduler/index.js';

export type { ArtifactsApi } from './presentation/internal/artifacts-api.js';
export type {
  ArtifactsModule,
  ArtifactsModuleDependencies,
} from './presentation/internal/artifacts-module.js';

type ArtifactsInfrastructure = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
};

export function createArtifactsModule(
  dependencies: ArtifactsModuleDependencies & {
    readonly agentRuns: Pick<AgentRunsApi, 'latestRun'>;
    readonly scheduler: Pick<SchedulerApi, 'answer'>;
  },
  overrides: Partial<ArtifactsInfrastructure> = {},
): ArtifactsModule {
  const { artifactRepository, artifactFiles }: ArtifactsInfrastructure = {
    artifactRepository: new SqliteArtifactRepository(dependencies.database),
    artifactFiles: new FileSystemArtifactFiles(),
    ...overrides,
  };
  const runPort = new AgentRunsAdapter(dependencies.agentRuns);
  const artifactService = new ArtifactService({
    artifactRepository,
    artifactFiles,
    runPort,
    events: dependencies.events,
    identifiers: dependencies.identifiers,
    clock: dependencies.clock,
  });
  const pageService = new PageService({
    artifactRepository,
    artifactFiles,
    runPort,
    schedulerPort: new SchedulerAdapter(dependencies.scheduler),
  });

  dependencies.agentTools.register(createShowArtifactTool(artifactService));

  return {
    routes: createArtifactsRoutes({
      kitDirectory: dependencies.kitDirectory,
      artifactService,
      pageService,
    }),
    jobs: {},
    internal: new ArtifactsFacade(),
  };
}
