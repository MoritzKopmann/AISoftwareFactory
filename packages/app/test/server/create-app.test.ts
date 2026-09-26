import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/create-app.js';

describe('createApp', () => {
  let staticDirectory: string;

  beforeEach(async () => {
    staticDirectory = await mkdtemp(join(tmpdir(), 'aisf-static-'));
    await writeFile(join(staticDirectory, 'index.html'), '<h1>placeholder</h1>');
  });

  afterEach(async () => {
    await rm(staticDirectory, { recursive: true, force: true });
  });

  it('should answer ok on the health route when the app is running', async () => {
    const response = await createApp({ staticDirectory, kitRoutes: new Hono() }).request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('should serve the placeholder page on the root path', async () => {
    const response = await createApp({ staticDirectory, kitRoutes: new Hono() }).request('/');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('placeholder');
  });

  it('should serve the kit routes under /aisf when the app is running', async () => {
    const kitRoutes = new Hono().get('/kit.css', (context) => context.text(':root {}'));

    const response = await createApp({ staticDirectory, kitRoutes }).request('/aisf/kit.css');

    expect(await response.text()).toBe(':root {}');
  });
});
