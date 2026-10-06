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
    const response = await createApp({
      staticDirectory,
      kitRoutes: new Hono(),
      pageRoutes: new Hono(),
      apiRoutes: [],
    }).request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('should serve the placeholder page on the root path', async () => {
    const response = await createApp({
      staticDirectory,
      kitRoutes: new Hono(),
      pageRoutes: new Hono(),
      apiRoutes: [],
    }).request('/');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('placeholder');
  });

  it('should serve the kit routes under /aisf when the app is running', async () => {
    const kitRoutes = new Hono().get('/kit.css', (context) => context.text(':root {}'));

    const response = await createApp({
      staticDirectory,
      kitRoutes,
      pageRoutes: new Hono(),
      apiRoutes: [],
    }).request('/aisf/kit.css');

    expect(await response.text()).toBe(':root {}');
  });

  it('should serve every api route list under /api when the app is running', async () => {
    const skillsRoutes = new Hono().get('/skills/status', (context) =>
      context.json({ state: 'passed' }),
    );
    const projectsRoutes = new Hono().get('/projects', (context) => context.json([]));

    const app = createApp({
      staticDirectory,
      kitRoutes: new Hono(),
      pageRoutes: new Hono(),
      apiRoutes: [skillsRoutes, projectsRoutes],
    });

    expect(await (await app.request('/api/skills/status')).json()).toEqual({ state: 'passed' });
    expect(await (await app.request('/api/projects')).json()).toEqual([]);
  });

  it('should route /a to the page routes ahead of the static fallback when the app is running', async () => {
    const pageRoutes = new Hono().get('/T/', (context) => context.text('page T'));

    const response = await createApp({
      staticDirectory,
      kitRoutes: new Hono(),
      pageRoutes,
      apiRoutes: [],
    }).request('/a/T/');

    expect(await response.text()).toBe('page T');
  });
});
