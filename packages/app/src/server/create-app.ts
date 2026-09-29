import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { relative } from 'node:path';

export type AppOptions = {
  readonly staticDirectory: string;
  readonly kitRoutes: Hono;
  readonly apiRoutes: ReadonlyArray<Hono>;
};

export function createApp(options: AppOptions): Hono {
  // serveStatic resolves its root relative to the working directory.
  const staticRoot = relative(process.cwd(), options.staticDirectory) || '.';

  const app = new Hono()
    .get('/health', (context) => context.json({ status: 'ok' }))
    .route('/aisf', options.kitRoutes);
  for (const routes of options.apiRoutes) {
    app.route('/api', routes);
  }
  return app.use('*', serveStatic({ root: staticRoot }));
}
