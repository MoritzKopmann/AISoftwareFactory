import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { relative } from 'node:path';

export type AppOptions = {
  readonly staticDirectory: string;
};

export function createApp(options: AppOptions): Hono {
  // serveStatic resolves its root relative to the working directory.
  const staticRoot = relative(process.cwd(), options.staticDirectory) || '.';

  return new Hono()
    .get('/health', (context) => context.json({ status: 'ok' }))
    .use('*', serveStatic({ root: staticRoot }));
}
