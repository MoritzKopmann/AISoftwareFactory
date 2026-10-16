import { Hono } from 'hono';
import { findOnPath } from './cli/find-on-path.js';
import type { DatabaseSync } from 'node:sqlite';
import { createArtifactsModule, type ArtifactsModule } from './modules/artifacts/index.js';
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
import {
  createSchedulerModule,
  type SchedulerApi,
  type SchedulerModule,
} from './modules/scheduler/index.js';
import {
  createTicketsModule,
  type TicketsApi,
  type TicketsModule,
} from './modules/tickets/index.js';
import type { AgentToolRegistry } from './shared/agent-tools.js';
import { InMemoryAgentToolRegistry } from './shared/in-memory-agent-tool-registry.js';
import type {
  DomainEvents,
  EventBus,
  EventPublisher,
  EventSubscriber,
} from './shared/event-bus.js';
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
  runner: RunnerApi,
  scheduler: SchedulerApi,
  events: EventPublisher,
): ArtifactsModule {
  return createArtifactsModule({
    database,
    agentTools,
    kitDirectory,
    runner,
    scheduler,
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
  events: EventBus,
  projects: ProjectsApi,
  runner: RunnerApi,
  logger: Logger,
): TicketsModule {
  return createTicketsModule({
    projects,
    runner,
    clock: new SystemClock(),
    events,
    logger,
    pollIntervalMilliseconds: config.watcherPollIntervalMilliseconds,
    snapshotIntervalMilliseconds: config.watcherSnapshotIntervalMilliseconds,
  });
}

function buildFindingsModule(
  database: DatabaseSync,
  agentTools: AgentToolRegistry,
  projects: ProjectsApi,
  tickets: TicketsApi,
  events: EventPublisher,
): FindingsModule {
  return createFindingsModule({
    database,
    agentTools,
    projects,
    tickets,
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
  events: EventSubscriber,
  projects: ProjectsApi,
  skills: SkillsApi,
  tickets: TicketsApi,
  runner: RunnerApi,
  logger: Logger,
): SchedulerModule {
  return createSchedulerModule({ events, projects, skills, tickets, runner, logger });
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
  const tickets = buildTicketsModule(config, eventBus, projects.internal, runner.internal, logger);
  const findings = buildFindingsModule(
    database,
    agentTools,
    projects.internal,
    tickets.internal,
    eventBus,
  );
  const scheduler = buildSchedulerModule(
    eventBus,
    projects.internal,
    skills.internal,
    tickets.internal,
    runner.internal,
    logger,
  );
  const artifacts = buildArtifactsModule(
    kitDirectory,
    database,
    agentTools,
    runner.internal,
    scheduler.internal,
    eventBus,
  );

  // Until a module migrates, its routes are mounted under today's prefixes.
  const routes = [
    skills.routes,
    projects.routes,
    runner.routes,
    artifacts.routes,
    tickets.routes,
    findings.routes,
    scheduler.routes,
    new Hono().route('/api', live.routes),
  ];

  const jobs: Jobs = {
    ...skills.jobs,
    ...scheduler.jobs,
    ...tickets.jobs,
    ...runner.jobs,
    ...projects.jobs,
    ...findings.jobs,
    ...artifacts.jobs,
  };

  return { routes, jobs };
}
