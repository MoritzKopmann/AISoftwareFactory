#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { isOnPath } from './cli/is-on-path.js';
import { openBrowser } from './cli/open-browser.js';
import { parseCliArguments } from './cli/parse-cli-arguments.js';
import { findPreflightProblems } from './cli/preflight.js';
import { createApp } from './server/create-app.js';
import { startServer } from './server/start-server.js';

const defaultPort = 4317;

const problems = findPreflightProblems({ nodeVersion: process.versions.node, isOnPath });
if (problems.length > 0) {
  console.error(['aisf cannot start:', ...problems.map((problem) => `- ${problem}`)].join('\n'));
  process.exit(1);
}

const options = parseCliArguments(process.argv.slice(2));
const staticDirectory = fileURLToPath(new URL('../../ui/dist', import.meta.url));

const runningServer = await startServer({
  app: createApp({ staticDirectory }),
  port: Number(process.env['AISF_PORT'] ?? defaultPort),
});

console.log(`aisf is running at ${runningServer.url}`);
if (options.openBrowser) {
  openBrowser(runningServer.url);
}
