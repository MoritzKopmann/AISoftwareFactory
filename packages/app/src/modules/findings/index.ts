import type { FindingRepository } from './business/port/repository/finding-repository.js';
import { FindingService } from './business/service/finding-service.js';
import { ProjectsAdapter } from './infrastructure/internal/projects-adapter.js';
import { TicketsAdapter } from './infrastructure/internal/tickets-adapter.js';
import { SqliteFindingRepository } from './infrastructure/repository/sqlite-finding-repository.js';
import { createFindingsRoutes } from './presentation/api/findings-routes.js';
import { FindingsFacade } from './presentation/internal/findings-facade.js';
import type {
  FindingsModule,
  FindingsModuleDependencies,
} from './presentation/internal/findings-module.js';
import { createReportFindingTool } from './presentation/tool/create-report-finding-tool.js';
import type { ProjectsApi } from '../projects/index.js';
import type { TicketsApi } from '../tickets/index.js';

export type { FindingsApi } from './presentation/internal/findings-api.js';
export type {
  FindingsModule,
  FindingsModuleDependencies,
} from './presentation/internal/findings-module.js';

type FindingsInfrastructure = {
  readonly findingRepository: FindingRepository;
};

export function createFindingsModule(
  dependencies: FindingsModuleDependencies & {
    readonly projects: Pick<ProjectsApi, 'list'>;
    readonly tickets: Pick<TicketsApi, 'createIdea'>;
  },
  overrides: Partial<FindingsInfrastructure> = {},
): FindingsModule {
  const { findingRepository }: FindingsInfrastructure = {
    findingRepository: new SqliteFindingRepository(dependencies.database),
    ...overrides,
  };
  const findingService = new FindingService({
    findingRepository,
    ticketPort: new TicketsAdapter(dependencies.tickets),
    projectPort: new ProjectsAdapter(dependencies.projects),
    events: dependencies.events,
    clock: dependencies.clock,
  });

  dependencies.agentTools.register(createReportFindingTool(findingService));

  return {
    routes: createFindingsRoutes(findingService),
    jobs: {},
    internal: new FindingsFacade(),
  };
}
