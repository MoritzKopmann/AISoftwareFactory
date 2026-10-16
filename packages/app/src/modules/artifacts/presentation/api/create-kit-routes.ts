import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { relative } from 'node:path';

export type KitRoutesOptions = {
  readonly kitDirectory: string;
};

const mountPath = '/aisf';

export function createKitRoutes(options: KitRoutesOptions): Hono {
  // serveStatic resolves its root relative to the working directory.
  const kitRoot = relative(process.cwd(), options.kitDirectory) || '.';

  return new Hono().use(
    '*',
    serveStatic({
      root: kitRoot,
      rewriteRequestPath: (requestPath) => requestPath.slice(mountPath.length),
    }),
  );
}
