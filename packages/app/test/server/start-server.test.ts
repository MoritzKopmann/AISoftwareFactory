import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { startServer, type RunningServer } from '../../src/server/start-server.js';

describe('startServer', () => {
  let runningServer: RunningServer | undefined;

  afterEach(async () => {
    await runningServer?.close();
    runningServer = undefined;
  });

  it('should listen on the loopback interface only when started', async () => {
    runningServer = await startServer({ app: new Hono(), port: 0 });

    const address = runningServer.server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');
  });

  it('should report the url it listens on when started', async () => {
    runningServer = await startServer({
      app: new Hono().get('/health', (context) => context.text('ok')),
      port: 0,
    });

    const response = await fetch(`${runningServer.url}/health`);
    expect(await response.text()).toBe('ok');
  });
});
