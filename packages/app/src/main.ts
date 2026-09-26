#!/usr/bin/env node
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createBridgeModule } from './modules/bridge/index.js';
import { ClaudeCliMarketplaceRegistry } from './modules/skills/infra/integrations/claude-cli-marketplace-registry.js';
import { ClaudeCliSmokeProbe } from './modules/skills/infra/integrations/claude-cli-smoke-probe.js';
import { FileSystemPluginMirror } from './modules/skills/infra/integrations/file-system-plugin-mirror.js';
import { createSkillsModule } from './modules/skills/index.js';
import { isOnPath } from './cli/is-on-path.js';
import { openBrowser } from './cli/open-browser.js';
import { parseCliArguments } from './cli/parse-cli-arguments.js';
import { findPreflightProblems } from './cli/preflight.js';
import { createApp } from './server/create-app.js';
import { startServer } from './server/start-server.js';
import { loadConfig } from './shared/config/load-config.js';
import { migrations } from './shared/db/migrations.js';
import { openDatabase } from './shared/db/open-database.js';
import { runMigrations } from './shared/db/run-migrations.js';
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
const bridge = createBridgeModule({ kitDirectory });
const skills = createSkillsModule({
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
});

runMigrations(openDatabase(config.databasePath), migrations);

const runningServer = await startServer({
  app: createApp({
    staticDirectory,
    kitRoutes: bridge.kitRoutes,
    skillsRoutes: skills.statusRoutes,
  }),
  port: config.port,
});

logger.info(`aisf is running at ${runningServer.url}`);
if (options.openBrowser) {
  openBrowser(runningServer.url);
}

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
