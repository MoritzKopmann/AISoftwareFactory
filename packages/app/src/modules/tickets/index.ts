import type { IssueFeeds } from './business/port/github/issue-feeds.js';
import type { IdeaCreation } from './business/port/github/idea-creation.js';
import type { TicketSource } from './business/port/github/ticket-source.js';
import type { TicketStatusWrites } from './business/port/github/ticket-status-writes.js';
import type { WatchStore } from './business/port/repository/watch-store.js';
import { IdeaService } from './business/service/idea-service.js';
import { RepositoryWatchService } from './business/service/repository-watch-service.js';
import { TicketReadService } from './business/service/ticket-read-service.js';
import { TicketStatusService } from './business/service/ticket-status-service.js';
import { FetchGraphQLTicketSource } from './infrastructure/github/fetch-graphql-ticket-source.js';
import { FetchIssueFeeds } from './infrastructure/github/fetch-issue-feeds.js';
import { GhCliGitHubToken } from './infrastructure/github/gh-cli-github-token.js';
import { GhCliIdeaCreation } from './infrastructure/github/gh-cli-idea-creation.js';
import { GhCliTicketStatusWrites } from './infrastructure/github/gh-cli-ticket-status-writes.js';
import { ProjectsRegisteredRepositories } from './infrastructure/internal/projects-registered-repositories.js';
import { AgentRunsActiveRunLookup } from './infrastructure/internal/agent-runs-active-run-lookup.js';
import { AgentRunsRunSettlement } from './infrastructure/internal/agent-runs-run-settlement.js';
import { AgentRunsRunWaitLookup } from './infrastructure/internal/agent-runs-run-wait-lookup.js';
import { InMemoryWatchStore } from './infrastructure/repository/in-memory-watch-store.js';
import { subscribeToProjectAdded } from './presentation/bus/subscribe-to-project-added.js';
import { subscribeToRunFinished } from './presentation/bus/subscribe-to-run-finished.js';
import { subscribeToRunFinishedSettlement } from './presentation/bus/subscribe-to-run-finished-settlement.js';
import { subscribeToRunWaiting } from './presentation/bus/subscribe-to-run-waiting.js';
import { subscribeToTicketStatusWritten } from './presentation/bus/subscribe-to-ticket-status-written.js';
import { createTicketsRoutes } from './presentation/api/tickets-routes.js';
import { createTicketsStopWatchingJob } from './presentation/cron/tickets-stop-watching-job.js';
import { createTicketsWatchRepositoriesJob } from './presentation/cron/tickets-watch-repositories-job.js';
import { TicketsFacade } from './presentation/internal/tickets-facade.js';
import type {
  TicketsModule,
  TicketsModuleDependencies,
} from './presentation/internal/tickets-module.js';
import type { ProjectsApi } from '../projects/index.js';
import type { AgentRunsApi } from '../agent-runs/index.js';

export type { TicketsApi } from './presentation/internal/tickets-api.js';
export type {
  TicketsModule,
  TicketsModuleDependencies,
} from './presentation/internal/tickets-module.js';
export type { IdeaDto } from './presentation/dto/internal/idea-dto.js';
export type { ProjectTicketDto } from './presentation/dto/internal/project-ticket-dto.js';
export type { RepositoryReferenceDto } from './presentation/dto/internal/repository-reference-dto.js';
export type { SyncStatusDto } from './presentation/dto/internal/sync-status-dto.js';
export type {
  ClosingPullRequestDto,
  TicketDto,
  TicketStatusDto,
  TicketTypeDto,
} from './presentation/dto/internal/ticket-dto.js';

type TicketsInfrastructure = {
  readonly issueFeeds: IssueFeeds;
  readonly ticketSource: TicketSource;
  readonly ideaCreation: IdeaCreation;
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly watchStore: WatchStore;
};

export function createTicketsModule(
  dependencies: TicketsModuleDependencies & {
    readonly projects: Pick<ProjectsApi, 'list'>;
    readonly agentRuns: Pick<AgentRunsApi, 'activeRuns' | 'activeWaits' | 'settle'>;
  },
  overrides: Partial<TicketsInfrastructure> = {},
): TicketsModule {
  const { clock, events, logger } = dependencies;
  const token = new GhCliGitHubToken();
  const infrastructure: TicketsInfrastructure = {
    issueFeeds: new FetchIssueFeeds({ fetch: globalThis.fetch, token }),
    ticketSource: new FetchGraphQLTicketSource({
      fetch: globalThis.fetch,
      token,
      now: () => new Date(),
    }),
    ideaCreation: new GhCliIdeaCreation(),
    ticketStatusWrites: new GhCliTicketStatusWrites(),
    watchStore: new InMemoryWatchStore(),
    ...overrides,
  };
  const registeredRepositories = new ProjectsRegisteredRepositories(dependencies.projects);

  const repositoryWatchService = new RepositoryWatchService({
    issueFeeds: infrastructure.issueFeeds,
    ticketSource: infrastructure.ticketSource,
    registeredRepositories,
    clock,
    events,
    watchStore: infrastructure.watchStore,
    pollIntervalMilliseconds: dependencies.pollIntervalMilliseconds,
    snapshotIntervalMilliseconds: dependencies.snapshotIntervalMilliseconds,
  });
  const activeRunLookup = new AgentRunsActiveRunLookup(dependencies.agentRuns);
  const ticketReadService = new TicketReadService({
    ticketSource: infrastructure.ticketSource,
    activeRunLookup,
    runWaitLookup: new AgentRunsRunWaitLookup(dependencies.agentRuns),
    clock,
    watchStore: infrastructure.watchStore,
  });
  const ticketStatusService = new TicketStatusService({
    ticketStatusWrites: infrastructure.ticketStatusWrites,
    activeRunLookup,
    runSettlement: new AgentRunsRunSettlement(dependencies.agentRuns),
    registeredRepositories,
    events,
    logger,
  });
  const ideaService = new IdeaService({
    ideaCreation: infrastructure.ideaCreation,
    repositoryWatchService,
  });

  const unsubscribers = [
    subscribeToProjectAdded(events, repositoryWatchService),
    subscribeToTicketStatusWritten(events, repositoryWatchService),
    subscribeToRunFinished(events, repositoryWatchService),
    subscribeToRunFinishedSettlement(events, ticketStatusService, logger),
    subscribeToRunWaiting(events, ticketStatusService, logger),
  ];

  return {
    routes: createTicketsRoutes({ ticketReadService, ticketStatusService }),
    jobs: {
      'tickets.watch-repositories': createTicketsWatchRepositoriesJob(repositoryWatchService),
      'tickets.stop-watching': createTicketsStopWatchingJob(repositoryWatchService, () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      }),
    },
    internal: new TicketsFacade({ ticketReadService, ticketStatusService, ideaService }),
  };
}
