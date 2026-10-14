import { Hono } from 'hono';
import { findOnPath } from './cli/find-on-path.js';
import type { DatabaseSync } from 'node:sqlite';
import { FileSystemArtifactFiles } from './modules/artifacts/infra/integrations/file-system-artifact-files.js';
import { SqliteArtifactRepository } from './modules/artifacts/infra/repositories/sqlite-artifact-repository.js';
import {
  createArtifactsModule,
  PageBusyError,
  type ArtifactsModule,
  type CheckpointAnswers,
} from './modules/artifacts/index.js';
import { SqliteFindingRepository } from './modules/findings/infra/repositories/sqlite-finding-repository.js';
import { createFindingsModule, type FindingsModule } from './modules/findings/index.js';
import { SystemClock } from './shared/clock/system-clock.js';
import {
  createProjectsModule,
  type ProjectsApi,
  type ProjectsModule,
} from './modules/projects/index.js';
import { createSkillsModule, type SkillsApi, type SkillsModule } from './modules/skills/index.js';
import { RandomUuidIdentifiers } from './shared/identifiers/random-uuid-identifiers.js';
import { createRunnerModule, type RunnerApi, type RunnerModule } from './modules/runner/index.js';
import { GhCliPullRequestMerges } from './modules/scheduler/infra/integrations/gh-cli-pull-request-merges.js';
import {
  createSchedulerModule,
  RunNotAnswerableError,
  RunAlreadyActiveError,
  type SchedulerModule,
} from './modules/scheduler/index.js';
import { FetchGraphQLTicketSource } from './modules/tickets/infra/integrations/fetch-graphql-ticket-source.js';
import { FetchIssueFeeds } from './modules/tickets/infra/integrations/fetch-issue-feeds.js';
import { GhCliTicketStatusWrites } from './modules/tickets/infra/integrations/gh-cli-ticket-status-writes.js';
import { GhCliIdeaCreation } from './modules/tickets/infra/integrations/gh-cli-idea-creation.js';
import { InMemoryWatchStore } from './modules/tickets/infra/integrations/in-memory-watch-store.js';
import { GhCliGitHubToken } from './modules/tickets/infra/integrations/gh-cli-github-token.js';
import {
  createTicketsModule,
  TicketNotAnswerableError,
  type ActiveRunLookup,
  type RunWaitLookup,
  type RunSettlement,
  type TicketsModule,
} from './modules/tickets/index.js';
import type { AgentToolRegistry } from './shared/agent-tools.js';
import { InMemoryAgentToolRegistry } from './shared/in-memory-agent-tool-registry.js';
import type { DomainEvents, EventPublisher, EventSubscriber } from './shared/event-bus.js';
import { createLiveModule } from './modules/live/index.js';
import { InMemoryEventBus } from './shared/in-memory-event-bus.js';
import type { Config } from './shared/config/load-config.js';
import { migrations } from './shared/db/migrations.js';
import { openDatabase } from './shared/db/open-database.js';
import { runMigrations } from './shared/db/run-migrations.js';
import type { Logger } from './shared/logger/create-logger.js';
import type { Jobs } from './shared/jobs.js';

function buildArtifactsModule(
  kitDirectory: string,
  database: DatabaseSync,
  agentTools: AgentToolRegistry,
  runner: Pick<RunnerApi, 'latestRun'>,
  checkpointAnswers: CheckpointAnswers,
  events: EventPublisher,
): ArtifactsModule {
  return createArtifactsModule({
    agentTools,
    kitDirectory,
    artifactRepository: new SqliteArtifactRepository(database),
    artifactFiles: new FileSystemArtifactFiles(),
    ticketRunLookup: {
      latest: (projectId, ticketNumber) => runner.latestRun(projectId, ticketNumber),
    },
    checkpointAnswers,
    events,
    identifiers: new RandomUuidIdentifiers(),
    clock: new SystemClock(),
  });
}

function buildProjectsModule(
  database: DatabaseSync,
  events: EventPublisher,
  skills: SkillsApi,
  logger: Logger,
): ProjectsModule {
  return createProjectsModule({ database, clock: new SystemClock(), events, logger, skills });
}

function buildSkillsModule(
  config: Config,
  pluginDirectory: string,
  events: EventPublisher,
  logger: Logger,
): SkillsModule {
  return createSkillsModule({
    events,
    logger,
    pluginDirectory,
    mirrorDirectory: config.pluginMirrorDirectory,
    probeDirectory: config.skillsProbeDirectory,
    environment: process.env,
    projectDirectory: process.cwd(),
  });
}

function buildTicketsModule(
  config: Config,
  events: EventPublisher & EventSubscriber,
  projects: ProjectsApi,
  activeRunLookup: ActiveRunLookup,
  runWaitLookup: RunWaitLookup,
  runSettlement: RunSettlement,
  logger: Logger,
): TicketsModule {
  const token = new GhCliGitHubToken();
  return createTicketsModule({
    issueFeeds: new FetchIssueFeeds({ fetch: globalThis.fetch, token }),
    ticketSource: new FetchGraphQLTicketSource({
      fetch: globalThis.fetch,
      token,
      now: () => new Date(),
    }),
    ideaCreation: new GhCliIdeaCreation(),
    clock: new SystemClock(),
    events,
    watchStore: new InMemoryWatchStore(),
    subscriber: events,
    registeredRepositories: {
      list: async () =>
        (await projects.list()).map(({ id, repository }) => ({ projectId: id, repository })),
    },
    activeRunLookup,
    runWaitLookup,
    ticketStatusWrites: new GhCliTicketStatusWrites(),
    runSettlement,
    logger,
    pollIntervalMilliseconds: config.watcherPollIntervalMilliseconds,
    snapshotIntervalMilliseconds: config.watcherSnapshotIntervalMilliseconds,
  });
}

function buildFindingsModule(
  database: DatabaseSync,
  agentTools: AgentToolRegistry,
  projects: ProjectsApi,
  tickets: TicketsModule,
  events: EventPublisher,
): FindingsModule {
  return createFindingsModule({
    agentTools,
    findingRepository: new SqliteFindingRepository(database),
    ticketCreator: {
      create: (repository, ticket) => tickets.createIdea(repository, ticket),
    },
    projectLookup: {
      find: async (projectId) => {
        const project = (await projects.list()).find(({ id }) => id === projectId);
        return project === undefined ? undefined : { repository: project.repository };
      },
    },
    events,
    clock: new SystemClock(),
  });
}

function buildRunnerModule(
  config: Config,
  database: DatabaseSync,
  events: EventPublisher,
  projects: ProjectsApi,
  claudeExecutablePath: string,
  agentTools: AgentToolRegistry,
  logger: Logger,
): RunnerModule {
  return createRunnerModule({
    database,
    projects,
    clock: new SystemClock(),
    identifiers: new RandomUuidIdentifiers(),
    events,
    agentTools,
    logger,
    claudeExecutablePath,
    pluginDirectory: config.pluginMirrorDirectory,
    worktreesDirectory: config.worktreesDirectory,
    liveAnswerWindowMilliseconds: config.liveAnswerWindowMilliseconds,
  });
}

function buildSchedulerModule(
  events: EventPublisher & EventSubscriber,
  projects: ProjectsApi,
  skills: SkillsApi,
  tickets: TicketsModule,
  runner: RunnerApi,
  logger: Logger,
): SchedulerModule {
  return createSchedulerModule({
    ticketAnswerGate: {
      begin: async (projectId, ticketNumber) => {
        try {
          await tickets.beginAnswer(projectId, ticketNumber);
        } catch (error) {
          if (error instanceof TicketNotAnswerableError) {
            throw new RunNotAnswerableError(error.message);
          }
          throw error;
        }
      },
      revert: (projectId, ticketNumber) => tickets.revertAnswer(projectId, ticketNumber),
    },
    pullRequestMerges: new GhCliPullRequestMerges(),
    runner: {
      start: async (request) => {
        const result = await runner.start({ ...request, mode: 'afk' });
        if (result.kind === 'already-active') {
          throw new RunAlreadyActiveError(result.message);
        }
        return result.run;
      },
      answer: async (runId, answer) => {
        const result = await runner.answer(runId, answer);
        switch (result.kind) {
          case 'already-active':
            throw new RunAlreadyActiveError(result.message);
          case 'not-resumable':
            throw new RunNotAnswerableError(result.message);
          case 'answered':
            return result.run;
        }
      },
      findRun: (runId) => runner.findRun(runId),
      activeRuns: (projectId) => runner.activeRuns(projectId),
      latestRun: (projectId, ticketNumber) => runner.latestRun(projectId, ticketNumber),
    },
    ideaCreation: { create: tickets.createIdea },
    ticketLookup: {
      find: async (projectId, ticketNumber) => {
        const projectTicket = await tickets.ticket(projectId, ticketNumber);
        const ticket = projectTicket?.ticket;
        if (projectTicket === undefined || ticket === undefined) {
          return undefined;
        }
        const snapshotTakenAt =
          projectTicket.sync.state === 'pending' ? undefined : projectTicket.sync.snapshotTakenAt;
        return {
          number: ticket.number,
          title: ticket.title,
          status: ticket.status,
          types: ticket.types,
          isLeaf: ticket.subIssueNumbers.length === 0,
          hasOpenBlocker: ticket.blockedBy.some((blocker) => blocker.open),
          subIssueNumbers: ticket.subIssueNumbers,
          ...(snapshotTakenAt === undefined ? {} : { snapshotTakenAt }),
        };
      },
    },
    reviewedTicketLookup: {
      list: async (projectId) => tickets.openTickets(projectId),
    },
    runsGate: { check: () => skills.runsBlocked() },
    projectLookup: {
      find: async (projectId) => {
        const project = (await projects.list()).find(({ id }) => id === projectId);
        return project === undefined
          ? undefined
          : { repository: project.repository, onboarded: project.contract.passed };
      },
    },
    subscriber: events,
    logger,
  });
}

export type ApplicationOptions = {
  readonly config: Config;
  readonly logger: Logger;
  readonly kitDirectory: string;
  readonly pluginDirectory: string;
};

export type Application = {
  readonly routes: ReadonlyArray<Hono>;
  /** Start-up jobs, keyed `<module>.<job-name>`. main.ts runs them by name. */
  readonly jobs: Jobs;
};

/** The one place the modules are wired to each other. */
export function composeApplication(options: ApplicationOptions): Application {
  const { config, logger, kitDirectory, pluginDirectory } = options;
  const database = openDatabase(config.databasePath);
  runMigrations(database, migrations);
  const eventBus = new InMemoryEventBus<DomainEvents>();

  const agentTools = new InMemoryAgentToolRegistry();

  const skills = buildSkillsModule(config, pluginDirectory, eventBus, logger);
  const live = createLiveModule({ events: eventBus });
  const projects = buildProjectsModule(database, eventBus, skills.internal, logger);
  const runner = buildRunnerModule(
    config,
    database,
    eventBus,
    projects.internal,
    findOnPath('claude') ?? 'claude',
    agentTools,
    logger,
  );
  const tickets = buildTicketsModule(
    config,
    eventBus,
    projects.internal,
    {
      activeRunTicketNumbers: async (projectId) =>
        (await runner.internal.activeRuns(projectId)).map(({ run }) => run.ticketNumber),
    },
    { waitsOf: (projectId) => runner.internal.activeWaits(projectId) },
    { settle: (runId) => runner.internal.settle(runId) },
    logger,
  );
  const findings = buildFindingsModule(database, agentTools, projects.internal, tickets, eventBus);
  const scheduler = buildSchedulerModule(
    eventBus,
    projects.internal,
    skills.internal,
    tickets,
    runner.internal,
    logger,
  );
  const artifacts = buildArtifactsModule(
    kitDirectory,
    database,
    agentTools,
    runner.internal,
    {
      answer: async (runId, text) => {
        try {
          await scheduler.answer(runId, { kind: 'checkpoint', text });
        } catch (error) {
          if (error instanceof RunNotAnswerableError || error instanceof RunAlreadyActiveError) {
            throw new PageBusyError(error.message);
          }
          throw error;
        }
      },
    },
    eventBus,
  );

  // Until a module migrates, its routes are mounted under today's prefixes.
  const routes = [
    skills.routes,
    projects.routes,
    runner.routes,
    new Hono().route('/aisf', artifacts.kitRoutes),
    new Hono().route('/a', artifacts.pageRoutes),
    ...[findings.routes, tickets.routes, scheduler.routes, artifacts.routes, live.routes].map(
      (moduleRoutes) => new Hono().route('/api', moduleRoutes),
    ),
  ];

  const jobs: Jobs = {
    ...skills.jobs,
    'scheduler.start': () => {
      scheduler.start();
      return Promise.resolve();
    },
    // Subscribes the run settlement, so it runs before the runner replays unsettled runs.
    'tickets.start': () => tickets.start(),
    ...runner.jobs,
    ...projects.jobs,
  };

  return { routes, jobs };
}
