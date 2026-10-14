import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './create-app.js';

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
    const response = await createApp({ staticDirectory, routes: [] }).request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('should serve the placeholder page on the root path', async () => {
    const response = await createApp({ staticDirectory, routes: [] }).request('/');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('placeholder');
  });

  it('should serve every route list at its own full paths when the app is running', async () => {
    const skillsRoutes = new Hono().get('/api/skills/status', (context) =>
      context.json({ state: 'passed' }),
    );
    const kitRoutes = new Hono().get('/aisf/kit.css', (context) => context.text(':root {}'));

    const app = createApp({ staticDirectory, routes: [skillsRoutes, kitRoutes] });

    expect(await (await app.request('/api/skills/status')).json()).toEqual({ state: 'passed' });
    expect(await (await app.request('/aisf/kit.css')).text()).toBe(':root {}');
  });

  it('should serve a route ahead of the static fallback when the app is running', async () => {
    const pageRoutes = new Hono().get('/a/T/', (context) => context.text('page T'));

    const response = await createApp({ staticDirectory, routes: [pageRoutes] }).request('/a/T/');

    expect(await response.text()).toBe('page T');
  });
});
