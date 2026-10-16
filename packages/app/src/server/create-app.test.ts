import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './create-app.js';

const local = { Host: 'localhost:4317' };

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
    const response = await createApp({ staticDirectory, routes: [] }).request('/health', {
      headers: local,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('should serve the placeholder page on the root path', async () => {
    const response = await createApp({ staticDirectory, routes: [] }).request('/', {
      headers: local,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('placeholder');
  });

  it('should serve every route list at its own full paths when the app is running', async () => {
    const skillsRoutes = new Hono().get('/api/skills/status', (context) =>
      context.json({ state: 'passed' }),
    );
    const kitRoutes = new Hono().get('/aisf/kit.css', (context) => context.text(':root {}'));

    const app = createApp({ staticDirectory, routes: [skillsRoutes, kitRoutes] });

    expect(await (await app.request('/api/skills/status', { headers: local })).json()).toEqual({
      state: 'passed',
    });
    expect(await (await app.request('/aisf/kit.css', { headers: local })).text()).toBe(':root {}');
  });

  it('should serve a route ahead of the static fallback when the app is running', async () => {
    const pageRoutes = new Hono().get('/a/T/', (context) => context.text('page T'));

    const response = await createApp({ staticDirectory, routes: [pageRoutes] }).request('/a/T/', {
      headers: local,
    });

    expect(await response.text()).toBe('page T');
  });

  describe('local request guard', () => {
    const buildGuarded = (): Hono => {
      const apiRoutes = new Hono()
        .get('/api/skills/status', (context) => context.json({ state: 'passed' }))
        .post('/api/projects', (context) => context.json({ created: true }, 201))
        .put('/a/T/_user-input-state', (context) => context.body(null, 204));
      const kitRoutes = new Hono()
        .get('/aisf/kit.css', (context) => context.text(':root {}'))
        .get('/a/T/', (context) => context.text('page T'));
      return createApp({ staticDirectory, routes: [apiRoutes, kitRoutes] });
    };

    it.each(['localhost:4317', '127.0.0.1:4317'])(
      'should serve a GET without Origin when the Host is %s',
      async (host) => {
        const response = await buildGuarded().request('/api/skills/status', {
          headers: { Host: host },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ state: 'passed' });
      },
    );

    it('should serve the page when GET / has a loopback Host', async () => {
      const response = await buildGuarded().request('/', { headers: { Host: '127.0.0.1:4317' } });

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('placeholder');
    });

    const paths = ['/api/skills/status', '/', '/health', '/aisf/kit.css', '/a/T/'];
    const hosts: ReadonlyArray<Record<string, string>> = [
      { Host: 'evil.example' },
      { Host: '192.168.1.20:4317' },
      { Host: '[::1]:4317' },
      {},
    ];
    for (const path of paths) {
      it.each(hosts)(`should answer 403 on ${path} when the headers are %j`, async (headers) => {
        const response = await buildGuarded().request(path, { headers });

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ message: 'Forbidden host' });
      });
    }

    it.each<Record<string, string>>([
      {},
      { Origin: 'http://evil.example' },
      { Origin: 'http://127.0.0.1:4317' },
    ])('should refuse a POST when the Origin is wrong or missing: %j', async (headers) => {
      const response = await buildGuarded().request('/api/projects', {
        method: 'POST',
        headers: { ...local, ...headers },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ message: 'Forbidden origin' });
    });

    it('should handle a POST when the Origin matches the Host', async () => {
      const response = await buildGuarded().request('/api/projects', {
        method: 'POST',
        headers: { ...local, Origin: 'http://localhost:4317' },
      });

      expect(response.status).toBe(201);
    });

    it('should not answer 403 on HEAD without Origin', async () => {
      const response = await buildGuarded().request('/', { method: 'HEAD', headers: local });

      expect(response.status).not.toBe(403);
    });

    it('should keep refusing a /a write when the Origin is foreign', async () => {
      const response = await buildGuarded().request('/a/T/_user-input-state', {
        method: 'PUT',
        headers: { ...local, Origin: 'http://evil.example' },
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ message: 'Forbidden origin' });
    });
  });
});
