#!/usr/bin/env node
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findOnPath } from './cli/find-on-path.js';
import { isOnPath } from './cli/is-on-path.js';
import { openBrowser } from './cli/open-browser.js';
import { parseCliArguments } from './cli/parse-cli-arguments.js';
import { findPreflightProblems } from './cli/preflight.js';
import { composeApplication } from './composition-root.js';
import { createApp } from './server/create-app.js';
import { startServer } from './server/start-server.js';
import { loadConfig } from './shared/config/load-config.js';
import type { Jobs } from './shared/jobs.js';
import { consoleLogSink, createLogger } from './shared/logger/create-logger.js';

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

const application = composeApplication({
  config,
  logger,
  kitDirectory,
  pluginDirectory,
  claudeExecutablePath: findOnPath('claude') ?? 'claude',
});

function runJob(jobs: Jobs, name: string): Promise<void> {
  const job = jobs[name];
  if (job === undefined) {
    throw new Error(`Unknown job: ${name}`);
  }
  return job();
}

// Never-crash boundary: a failed repository watch must not end the process.
runJob(application.jobs, 'tickets.watch-repositories').catch((error: unknown) => {
  logger.error(`The tickets module failed to start: ${String(error)}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    // The job stops the sessions before its first await, so it is done when the process exits.
    // Never-crash boundary: the process is exiting, so a failed abort has nowhere to go.
    runJob(application.jobs, 'runner.abort-sessions').catch(() => undefined);
    process.exit(0);
  });
}

// Never-crash boundary: a failed recovery must not keep the server from starting.
try {
  await runJob(application.jobs, 'runner.recover-interrupted-runs');
} catch (error) {
  logger.error(`Recovering interrupted runs failed: ${String(error)}`);
}

const runningServer = await startServer({
  app: createApp({ staticDirectory, routes: application.routes }),
  port: config.port,
});

logger.info(`aisf is running at ${runningServer.url}`);
if (options.openBrowser) {
  openBrowser(runningServer.url);
}

// Never-crash boundary: a failed label sync must not end the process or delay the boot.
runJob(application.jobs, 'projects.sync-labels').catch((error: unknown) => {
  logger.error(`Syncing the project labels failed: ${String(error)}`);
});

// Never-crash boundary: the browser panel polls the status route while the start-up checks run.
try {
  await runJob(application.jobs, 'skills.start-up-checks');
} catch (error) {
  logger.error(`Skills start-up failed unexpectedly: ${String(error)}`);
}
