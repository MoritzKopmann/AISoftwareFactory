#!/usr/bin/env node
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { createBridgeModule, type BridgeModule } from './modules/bridge/index.js';
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
import { ClaudeAgentSdkSessions } from './modules/runner/infra/integrations/claude-agent-sdk-sessions.js';
import { GitCliWorktrees } from './modules/runner/infra/integrations/git-cli-worktrees.js';
import { InMemoryRecentRunSteps } from './modules/runner/infra/integrations/in-memory-recent-run-steps.js';
import { RandomUuidIdentifiers } from './modules/runner/infra/integrations/random-uuid-identifiers.js';
import { SqliteRunRepository } from './modules/runner/infra/repositories/sqlite-run-repository.js';
import { createRunnerModule, type RunTool, type RunnerModule } from './modules/runner/index.js';
import { GhCliGitHubWrites } from './modules/scheduler/infra/integrations/gh-cli-github-writes.js';
import { SqliteFindingRepository } from './modules/scheduler/infra/repositories/sqlite-finding-repository.js';
import {
  createFindingReportingTool,
  createSchedulerModule,
  type SchedulerModule,
} from './modules/scheduler/index.js';
import { createUiModule, type UiModule } from './modules/ui/index.js';
import { FetchGraphQLTicketSource } from './modules/watcher/infra/integrations/fetch-graphql-ticket-source.js';
import { FetchIssueFeeds } from './modules/watcher/infra/integrations/fetch-issue-feeds.js';
import { GhCliGitHubToken } from './modules/watcher/infra/integrations/gh-cli-github-token.js';
import { createWatcherModule, type WatcherModule } from './modules/watcher/index.js';
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

function buildBridgeModule(kitDirectory: string): BridgeModule {
  return createBridgeModule({ kitDirectory });
}

function buildProjectsModule(
  database: DatabaseSync,
  events: EventPublisher,
  skills: SkillsModule,
): ProjectsModule {
  return createProjectsModule({
    projectRepository: new SqliteProjectRepository(database),
    repositoryResolver: new GhCliRepositoryResolver(),
    labelSync: new GhCliLabelSync(),
    pluginInstaller: { install: (checkoutPath) => skills.installPluginLocally(checkoutPath) },
    clock: new SystemClock(),
    contractPreflight: { check: (checkoutPath) => skills.runContractPreflight(checkoutPath) },
    events,
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
    pollIntervalMilliseconds: config.watcherPollIntervalMilliseconds,
    snapshotIntervalMilliseconds: config.watcherSnapshotIntervalMilliseconds,
  });
}

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
        };
      },
    },
    recentRunSteps: new InMemoryRecentRunSteps(),
    identifiers: new RandomUuidIdentifiers(),
    clock,
    events,
    worktreesDirectory: config.worktreesDirectory,
    appTools,
    logger,
  });
}

function buildSchedulerModule(
  findingRepository: SqliteFindingRepository,
  events: EventSubscriber,
  projects: ProjectsModule,
  skills: SkillsModule,
  watcher: WatcherModule,
  runner: RunnerModule,
  logger: Logger,
): SchedulerModule {
  return createSchedulerModule({
    gitHubWrites: new GhCliGitHubWrites(),
    runner: {
      start: async ({ projectId, ticketNumber }) => {
        const { id, startedAt } = await runner.start({
          projectId,
          ticketNumber,
          stage: 'implement',
          mode: 'afk',
        });
        return { id, startedAt };
      },
      activeRun: async (projectId) => {
        const activeRun = await runner.activeRun(projectId);
        return activeRun === undefined ? undefined : { ticketNumber: activeRun.run.ticketNumber };
      },
      lastRunEndedAt: async (projectId, ticketNumber) =>
        (await runner.latestRun(projectId, ticketNumber))?.endedAt,
      settle: (runId) => runner.settle(runId),
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
          hitl: ticket.hitl,
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
    findingRepository,
    clock: new SystemClock(),
    subscriber: events,
    logger,
  });
}

function buildUiModule(
  projects: ProjectsModule,
  skills: SkillsModule,
  watcher: WatcherModule,
  runner: RunnerModule,
  scheduler: SchedulerModule,
): UiModule {
  return createUiModule({
    projects,
    skills,
    watcher,
    runs: {
      availability: (projectId, ticketNumber) => scheduler.runAvailability(projectId, ticketNumber),
      activeRun: (projectId) => runner.activeRun(projectId),
      latestRun: (projectId, ticketNumber) => runner.latestRun(projectId, ticketNumber),
      start: (projectId, ticketNumber) => scheduler.startRun(projectId, ticketNumber),
      stop: (runId) => runner.stop(runId),
    },
    findings: scheduler,
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

const bridge = buildBridgeModule(kitDirectory);
const skills = buildSkillsModule(config, pluginDirectory);
const projects = buildProjectsModule(database, eventBus, skills);
const watcher = buildWatcherModule(config, eventBus, projects);
const findingRepository = new SqliteFindingRepository(database);
const runner = buildRunnerModule(
  config,
  database,
  eventBus,
  projects,
  watcher,
  findOnPath('claude') ?? 'claude',
  [createFindingReportingTool({ findingRepository, clock: new SystemClock() })],
  logger,
);
const scheduler = buildSchedulerModule(
  findingRepository,
  eventBus,
  projects,
  skills,
  watcher,
  runner,
  logger,
);
scheduler.start();
const ui = buildUiModule(projects, skills, watcher, runner, scheduler);

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
    kitRoutes: bridge.kitRoutes,
    uiRoutes: ui.routes,
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
