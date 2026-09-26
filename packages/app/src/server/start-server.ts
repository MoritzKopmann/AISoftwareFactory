import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import type { AddressInfo } from 'node:net';

const loopbackAddress = '127.0.0.1';

export type StartServerOptions = {
  readonly app: Hono;
  readonly port: number;
};

export type RunningServer = {
  readonly server: ReturnType<typeof serve>;
  readonly url: string;
  readonly close: () => Promise<void>;
};

export function startServer(options: StartServerOptions): Promise<RunningServer> {
  return new Promise((resolve) => {
    const server = serve(
      { fetch: options.app.fetch, hostname: loopbackAddress, port: options.port },
      (address: AddressInfo) => {
        resolve({
          server,
          url: `http://${loopbackAddress}:${address.port}`,
          close: () =>
            new Promise((closed) => {
              server.close(() => closed());
            }),
        });
      },
    );
  });
}
