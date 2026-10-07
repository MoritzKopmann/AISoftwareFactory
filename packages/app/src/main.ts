#!/usr/bin/env node
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { FileSystemArtifactFiles } from './modules/artifacts/infra/integrations/file-system-artifact-files.js';
import { SqliteArtifactRepository } from './modules/artifacts/infra/repositories/sqlite-artifact-repository.js';
import {
  createArtifactsModule,
  PageBusyError,
  type ArtifactsModule,
  type CheckpointAnswers,
} from './modules/artifacts/index.js';
import { GhCliTicketCreator } from './modules/findings/infra/integrations/gh-cli-ticket-creator.js';
import { SqliteFindingRepository } from './modules/findings/infra/repositories/sqlite-finding-repository.js';
import { createFindingsModule, type FindingsModule } from './modules/findings/index.js';
import { GhCliLabelSync } from './modules/projects/infra/integrations/gh-cli-label-sync.js';
import { GhCliRepositoryResolver } from './modules/projects/infra/integrations/gh-cli-repository-resolver.js';
import { SystemClock } from './shared/clock/system-clock.js';
import { SqliteProjectRepository } from './modules/projects/infra/repositories/sqlite-project-repository.js';
import { createProjectsModule, type ProjectsModule } from './modules/projects/index.js';
import { ClaudeCliLocalPluginInstaller } from './modules/skills/infra/integrations/claude-cli-local-plugin-installer.js';
import { ClaudeCliMarketplaceRegistry } from './modules/skills/infra/integrations/claude-cli-marketplace-registry.js';
import { ClaudeCliSmokeProbe } from './modules/skills/infra/integrations/claude-cli-smoke-probe.js';
import { EnvironmentCredentialSource } from './modules/skills/infra/integrations/environment-credential-source.js';
import { FileSystemPluginMirror } from './modules/skills/infra/integrations/file-system-plugin-mirror.js';
import { FileSystemSlotReader } from './modules/skills/infra/integrations/file-system-slot-reader.js';
import { createSkillsModule, type SkillsModule } from './modules/skills/index.js';
import { ClaudeAgentSdkSessionTranscripts } from './modules/runner/infra/integrations/claude-agent-sdk-session-transcripts.js';
import { ClaudeAgentSdkSessions } from './modules/runner/infra/integrations/claude-agent-sdk-sessions.js';
import { GitCliWorktrees } from './modules/runner/infra/integrations/git-cli-worktrees.js';
import { InMemoryRunAnswerWaits } from './modules/runner/infra/integrations/in-memory-run-answer-waits.js';
import { InMemoryRecentRunSteps } from './modules/runner/infra/integrations/in-memory-recent-run-steps.js';
import { RandomUuidIdentifiers } from './shared/identifiers/random-uuid-identifiers.js';
import { SqliteRunRepository } from './modules/runner/infra/repositories/sqlite-run-repository.js';
import {
  createRunnerModule,
  RunAlreadyActiveError as RunnerRunAlreadyActiveError,
  RunNotResumableError,
  type RunTool,
  type RunnerModule,
} from './modules/runner/index.js';
import { GhCliPullRequestMerges } from './modules/scheduler/infra/integrations/gh-cli-pull-request-merges.js';
import { GhCliTicketStatusWrites } from './modules/scheduler/infra/integrations/gh-cli-ticket-status-writes.js';
import {
  createSchedulerModule,
  RunNotAnswerableError,
  RunAlreadyActiveError,
  type SchedulerModule,
} from './modules/scheduler/index.js';
import { FetchGraphQLTicketSource } from './modules/watcher/infra/integrations/fetch-graphql-ticket-source.js';
import { FetchIssueFeeds } from './modules/watcher/infra/integrations/fetch-issue-feeds.js';
import { GhCliGitHubToken } from './modules/watcher/infra/integrations/gh-cli-github-token.js';
import {
  createWatcherModule,
  type ActiveRunLookup,
  type WatcherModule,
} from './modules/watcher/index.js';
import { findOnPath } from './cli/find-on-path.js';
import { isOnPath } from './cli/is-on-path.js';
import { openBrowser } from './cli/open-browser.js';
import { parseCliArguments } from './cli/parse-cli-arguments.js';
import { findPreflightProblems } from './cli/preflight.js';
import { createApp } from './server/create-app.js';
import { startServer } from './server/start-server.js';
import type { EventPublisher } from './shared/bus/event-publisher.js';
import type { EventSubscriber } from './shared/bus/event-subscriber.js';
import { TypedEventBus } from './shared/bus/typed-event-bus.js';
import type { AisfEventMap } from './shared/bus/aisf-event-map.js';
import type { Config } from './shared/config/load-config.js';
import { loadConfig } from './shared/config/load-config.js';
import { migrations } from './shared/db/migrations.js';
import { openDatabase } from './shared/db/open-database.js';
import { runMigrations } from './shared/db/run-migrations.js';
import { consoleLogSink, createLogger, type Logger } from './shared/logger/create-logger.js';

function buildArtifactsModule(
  kitDirectory: string,
  database: DatabaseSync,
  runner: Pick<RunnerModule, 'latestRun'>,
  checkpointAnswers: CheckpointAnswers,
): ArtifactsModule {
  return createArtifactsModule({
    kitDirectory,
    artifactRepository: new SqliteArtifactRepository(database),
    artifactFiles: new FileSystemArtifactFiles(),
    ticketRunLookup: {
      latest: (projectId, ticketNumber) => runner.latestRun(projectId, ticketNumber),
    },
    checkpointAnswers,
    identifiers: new RandomUuidIdentifiers(),
    clock: new SystemClock(),
  });
}

function buildProjectsModule(
  database: DatabaseSync,
  events: EventPublisher,
  skills: SkillsModule,
  logger: Logger,
): ProjectsModule {
  return createProjectsModule({
    projectRepository: new SqliteProjectRepository(database),
    repositoryResolver: new GhCliRepositoryResolver(),
    labelSync: new GhCliLabelSync(),
    pluginInstaller: { install: (checkoutPath) => skills.installPluginLocally(checkoutPath) },
    clock: new SystemClock(),
    contractPreflight: { check: (checkoutPath) => skills.runContractPreflight(checkoutPath) },
    events,
    logger,
  });
}

function buildSkillsModule(config: Config, pluginDirectory: string): SkillsModule {
  return createSkillsModule({
    pluginMirror: new FileSystemPluginMirror({
      sourceDirectory: pluginDirectory,
      mirrorDirectory: config.pluginMirrorDirectory,
    }),
    marketplaceRegistry: new ClaudeCliMarketplaceRegistry(),
    smokeProbe: new ClaudeCliSmokeProbe({
      probeDirectory: config.skillsProbeDirectory,
      pluginDirectory: config.pluginMirrorDirectory,
    }),
    mirrorDirectory: config.pluginMirrorDirectory,
    slotReader: new FileSystemSlotReader(),
    localPluginInstaller: new ClaudeCliLocalPluginInstaller(),
    credentialSource: new EnvironmentCredentialSource({
      environment: process.env,
      projectDirectory: process.cwd(),
    }),
  });
}

function buildWatcherModule(
  config: Config,
  events: EventPublisher & EventSubscriber,
  projects: ProjectsModule,
  activeRunLookup: ActiveRunLookup,
): WatcherModule {
  const token = new GhCliGitHubToken();
  return createWatcherModule({
    issueFeeds: new FetchIssueFeeds({ fetch: globalThis.fetch, token }),
    ticketSource: new FetchGraphQLTicketSource({
      fetch: globalThis.fetch,
      token,
      now: () => new Date(),
    }),
    clock: new SystemClock(),
    events,
    subscriber: events,
    registeredRepositories: {
      list: async () =>
        (await projects.list()).map(({ id, repository }) => ({ projectId: id, repository })),
    },
    activeRunLookup,
    pollIntervalMilliseconds: config.watcherPollIntervalMilliseconds,
    snapshotIntervalMilliseconds: config.watcherSnapshotIntervalMilliseconds,
  });
}

function buildFindingsModule(database: DatabaseSync, projects: ProjectsModule): FindingsModule {
  return createFindingsModule({
    findingRepository: new SqliteFindingRepository(database),
    ticketCreator: new GhCliTicketCreator(),
    projectLookup: {
      find: async (projectId) => {
        const project = (await projects.list()).find(({ id }) => id === projectId);
        return project === undefined ? undefined : { repository: project.repository };
      },
    },
    clock: new SystemClock(),
  });
}

const toolCallTimeoutMarginMilliseconds = 600_000;

function buildRunnerModule(
  config: Config,
  database: DatabaseSync,
  events: EventPublisher,
  projects: ProjectsModule,
  watcher: WatcherModule,
  claudeExecutablePath: string,
  appTools: ReadonlyArray<RunTool>,
  logger: Logger,
): RunnerModule {
  const clock = new SystemClock();
  return createRunnerModule({
    runRepository: new SqliteRunRepository(database),
    agentSessions: new ClaudeAgentSdkSessions({
      claudeExecutablePath,
      pluginDirectory: config.pluginMirrorDirectory,
      now: () => clock.now(),
      toolCallTimeoutMilliseconds:
        config.liveAnswerWindowMilliseconds + toolCallTimeoutMarginMilliseconds,
    }),
    worktrees: new GitCliWorktrees(),
    runTargets: {
      find: async (projectId, ticketNumber) => {
        const project = (await projects.list()).find(({ id }) => id === projectId);
        const projectTicket = await watcher.ticket(projectId, ticketNumber);
        if (project === undefined || projectTicket?.ticket === undefined) {
          return undefined;
        }
        return {
          checkoutPath: project.checkoutPath,
          repositoryName: project.repository.name,
          ticketTitle: projectTicket.ticket.title,
          types: projectTicket.ticket.types,
        };
      },
    },
    recentRunSteps: new InMemoryRecentRunSteps(),
    sessionTranscripts: new ClaudeAgentSdkSessionTranscripts(),
    identifiers: new RandomUuidIdentifiers(),
    runAnswerWaits: new InMemoryRunAnswerWaits(),
    liveAnswerWindowMilliseconds: config.liveAnswerWindowMilliseconds,
    clock,
    events,
    worktreesDirectory: config.worktreesDirectory,
    appTools,
    logger,
  });
}

function buildSchedulerModule(
  events: EventPublisher & EventSubscriber,
  projects: ProjectsModule,
  skills: SkillsModule,
  watcher: WatcherModule,
  runner: RunnerModule,
  logger: Logger,
): SchedulerModule {
  return createSchedulerModule({
    ticketStatusWrites: new GhCliTicketStatusWrites(),
    pullRequestMerges: new GhCliPullRequestMerges(),
    runner: {
      start: async ({ projectId, ticketNumber }) => {
        try {
          return await runner.start({ projectId, ticketNumber, mode: 'afk' });
        } catch (error) {
          if (error instanceof RunnerRunAlreadyActiveError) {
            throw new RunAlreadyActiveError(error.message);
          }
          throw error;
        }
      },
      answer: async (runId, answer) => {
        try {
          return await runner.answer(runId, answer);
        } catch (error) {
          if (error instanceof RunnerRunAlreadyActiveError) {
            throw new RunAlreadyActiveError(error.message);
          }
          if (error instanceof RunNotResumableError) {
            throw new RunNotAnswerableError(error.message);
          }
          throw error;
        }
      },
      findRun: runner.findRun,
      activeRuns: runner.activeRuns,
      latestRun: runner.latestRun,
      settle: runner.settle,
      sessionLog: runner.sessionLog,
    },
    ticketLookup: {
      find: async (projectId, ticketNumber) => {
        const projectTicket = await watcher.ticket(projectId, ticketNumber);
        const ticket = projectTicket?.ticket;
        if (projectTicket === undefined || ticket === undefined) {
          return undefined;
        }
        const snapshotTakenAt =
          projectTicket.sync.state === 'pending' ? undefined : projectTicket.sync.snapshotTakenAt;
        return {
          number: ticket.number,
          status: ticket.status,
          types: ticket.types,
          isLeaf: ticket.subIssueNumbers.length === 0,
          hasOpenBlocker: ticket.blockedBy.some((blocker) => blocker.open),
          ...(snapshotTakenAt === undefined ? {} : { snapshotTakenAt }),
        };
      },
    },
    reviewedTicketLookup: {
      list: async (projectId) => watcher.openTickets(projectId),
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
    events,
    subscriber: events,
    logger,
  });
}

const logger = createLogger(consoleLogSink);

const problems = findPreflightProblems({ nodeVersion: process.versions.node, isOnPath });
if (problems.length > 0) {
  logger.error(['aisf cannot start:', ...problems.map((problem) => `- ${problem}`)].join('\n'));
  process.exit(1);
}

const options = parseCliArguments(process.argv.slice(2));
const config = loadConfig({ environment: process.env, userHomeDirectory: homedir() });
const staticDirectory = fileURLToPath(new URL('../../ui/dist', import.meta.url));
const kitDirectory = fileURLToPath(new URL('../assets/kit', import.meta.url));
const pluginDirectory = fileURLToPath(new URL('../../plugin', import.meta.url));

const database = openDatabase(config.databasePath);
runMigrations(database, migrations);
const eventBus = new TypedEventBus<AisfEventMap>();

const skills = buildSkillsModule(config, pluginDirectory);
const projects = buildProjectsModule(database, eventBus, skills, logger);
// The watcher is built before the runner, which needs watcher.ticket, so the lookup binds late.
const watcher = buildWatcherModule(config, eventBus, projects, {
  activeRunTicketNumbers: async (projectId) =>
    (await runner.activeRuns(projectId)).map(({ run }) => run.ticketNumber),
});
const findings = buildFindingsModule(database, projects);
// The artifacts module needs runner.latestRun and the runner needs its tools, so the lookup binds late.
// The same goes for scheduler.answer, which delivers a page's event.
const artifacts: ArtifactsModule = buildArtifactsModule(
  kitDirectory,
  database,
  { latestRun: (projectId, ticketNumber) => runner.latestRun(projectId, ticketNumber) },
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
);
const runner = buildRunnerModule(
  config,
  database,
  eventBus,
  projects,
  watcher,
  findOnPath('claude') ?? 'claude',
  [...findings.tools, ...artifacts.tools],
  logger,
);
const scheduler = buildSchedulerModule(eventBus, projects, skills, watcher, runner, logger);
scheduler.start();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    runner.abortSessions();
    process.exit(0);
  });
}

try {
  await runner.recover();
} catch (error) {
  logger.error(`Recovering interrupted runs failed: ${String(error)}`);
}

const runningServer = await startServer({
  app: createApp({
    staticDirectory,
    kitRoutes: artifacts.kitRoutes,
    pageRoutes: artifacts.pageRoutes,
    apiRoutes: [
      projects.routes,
      skills.routes,
      findings.routes,
      watcher.routes,
      scheduler.routes,
      runner.routes,
      artifacts.routes,
    ],
  }),
  port: config.port,
});

logger.info(`aisf is running at ${runningServer.url}`);
if (options.openBrowser) {
  openBrowser(runningServer.url);
}

watcher.start().catch((error: unknown) => {
  logger.error(`The watcher failed to start: ${String(error)}`);
});
// Never-crash boundary: a failed label sync must not end the process or delay the boot.
projects.start().catch((error: unknown) => {
  logger.error(`Syncing the project labels failed: ${String(error)}`);
});

// The browser panel polls the status route while the start-up checks run.
try {
  await skills.start();
} catch (error) {
  logger.error(`Skills start-up failed unexpectedly: ${String(error)}`);
}
const runsBlocked = skills.runsBlocked();
if (runsBlocked.blocked) {
  logger.error(`Runs are blocked: ${runsBlocked.reason}`);
}
