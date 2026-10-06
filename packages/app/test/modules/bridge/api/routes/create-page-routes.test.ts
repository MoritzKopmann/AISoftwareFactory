import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPageRoutes } from '../../../../../src/modules/bridge/api/routes/create-page-routes.js';
import { FileSystemArtifactFiles } from '../../../../../src/modules/bridge/infra/integrations/file-system-artifact-files.js';
import { SqliteArtifactRepository } from '../../../../../src/modules/bridge/infra/repositories/sqlite-artifact-repository.js';
import type { TicketLatestRun } from '../../../../../src/modules/bridge/logic/domain/types/ticket-latest-run.js';
import { ReadPageAssetUseCase } from '../../../../../src/modules/bridge/logic/use-cases/read-page-asset-use-case.js';
import { ReadPageStateUseCase } from '../../../../../src/modules/bridge/logic/use-cases/read-page-state-use-case.js';
import { ReadPageStatusUseCase } from '../../../../../src/modules/bridge/logic/use-cases/read-page-status-use-case.js';
import { ReadPageUseCase } from '../../../../../src/modules/bridge/logic/use-cases/read-page-use-case.js';
import { WritePageStateUseCase } from '../../../../../src/modules/bridge/logic/use-cases/write-page-state-use-case.js';
import { migrations } from '../../../../../src/shared/db/migrations.js';
import { openDatabase } from '../../../../../src/shared/db/open-database.js';
import { runMigrations } from '../../../../../src/shared/db/run-migrations.js';
import { FakeTicketRunLookup } from '../../fakes/fake-ticket-run-lookup.js';

const host = '127.0.0.1:4000';
const origin = 'http://127.0.0.1:4000';
const validHeaders = { Host: host, Origin: origin };

function buildApp(database: DatabaseSync, ticketRunLookup: FakeTicketRunLookup): Hono {
  const artifactRepository = new SqliteArtifactRepository(database);
  const artifactFiles = new FileSystemArtifactFiles();
  return new Hono().route(
    '/a',
    createPageRoutes({
      readPage: new ReadPageUseCase({ artifactRepository, artifactFiles }),
      readAsset: new ReadPageAssetUseCase({ artifactRepository, artifactFiles }),
      readStatus: new ReadPageStatusUseCase({ artifactRepository, ticketRunLookup }),
      readState: new ReadPageStateUseCase({ artifactRepository, artifactFiles }),
      writeState: new WritePageStateUseCase({ artifactRepository, artifactFiles }),
    }),
  );
}

describe('createPageRoutes', () => {
  let root: string;
  let directory: string;
  let database: DatabaseSync;
  let ticketRunLookup: FakeTicketRunLookup;
  let app: Hono;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'aisf-pages-'));
    directory = join(root, 'plan');
    mkdirSync(directory);
    writeFileSync(
      join(directory, 'index.html'),
      '<!doctype html><html><head><title>Plan</title><script>window.a = 1;</script></head><body><script src="app.js"></script></body></html>',
    );
    writeFileSync(join(directory, 'app.js'), 'console.log(1);');
    writeFileSync(join(root, 'secret'), 'S');
    symlinkSync(join(root, 'secret'), join(directory, 'link'));
    database = openDatabase(join(root, 'aisf.db'));
    runMigrations(database, migrations);
    await new SqliteArtifactRepository(database).publish({
      token: 'T',
      projectId: 'o/n',
      ticketNumber: 7,
      artifactId: 'plan',
      title: 'Plan review',
      directory,
      runId: 'r1',
      publishedAt: '2026-10-06T10:00:00.000Z',
    });
    ticketRunLookup = new FakeTicketRunLookup();
    app = buildApp(database, ticketRunLookup);
  });

  afterEach(() => {
    database.close();
    rmSync(root, { recursive: true, force: true });
  });

  describe('GET /:token/', () => {
    it('should serve the page with the kit links and a nonce on every script when the token is known', async () => {
      const response = await app.request('/a/T/', { headers: { Host: host } });
      const html = await response.text();
      const nonce = /nonce-([^']+)'/.exec(
        response.headers.get('Content-Security-Policy') ?? '',
      )?.[1];

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      expect(html).toContain('href="/aisf/kit.css"');
      expect(html).toContain('src="/aisf/bridge.js"');
      const scripts = html.match(/<script[^>]*>/g) ?? [];
      expect(scripts).toHaveLength(3);
      for (const script of scripts) {
        expect(script).toContain(`nonce="${nonce}"`);
      }
    });

    it('should use a different nonce when the page is requested twice', async () => {
      const first = await app.request('/a/T/', { headers: { Host: host } });
      const second = await app.request('/a/T/', { headers: { Host: host } });

      expect(first.headers.get('Content-Security-Policy')).not.toBe(
        second.headers.get('Content-Security-Policy'),
      );
    });

    it('should send the security headers when the page is served', async () => {
      const response = await app.request('/a/T/', { headers: { Host: host } });
      const nonce = /nonce-([^']+)'/.exec(
        response.headers.get('Content-Security-Policy') ?? '',
      )?.[1];

      expect(response.headers.get('Content-Security-Policy')).toBe(
        `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src http://127.0.0.1:4000/a/T/; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      );
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });
  });

  describe('GET /:token/*', () => {
    it('should serve the file with its content type and the same headers when it is inside the directory', async () => {
      const response = await app.request('/a/T/app.js', { headers: { Host: host } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('javascript');
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.text()).toBe('console.log(1);');
    });

    it.each(['/a/T/../secret', '/a/T/%2e%2e/secret', '/a/T/..%2Fsecret', '/a/T/link'])(
      'should answer 404 when %s points outside the directory',
      async (path) => {
        const response = await app.request(path, { headers: { Host: host } });

        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain('S');
      },
    );
  });

  describe('unknown token', () => {
    it.each([
      ['GET', '/a/unknown/'],
      ['GET', '/a/unknown/app.js'],
      ['GET', '/a/unknown/_status'],
      ['GET', '/a/unknown/_state'],
      ['PUT', '/a/unknown/_state'],
    ])('should answer 404 when %s %s is requested', async (method, path) => {
      const response = await app.request(path, {
        method,
        headers: validHeaders,
        ...(method === 'PUT' ? { body: '{}' } : {}),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Host check', () => {
    it.each(['/a/T/', '/a/T/app.js', '/a/T/_status', '/a/T/_state'])(
      'should answer 403 when %s has a foreign Host',
      async (path) => {
        const response = await app.request(path, { headers: { Host: 'evil.example:4000' } });

        expect(response.status).toBe(403);
      },
    );

    it('should answer 403 when there is no Host', async () => {
      expect((await app.request('/a/T/_status')).status).toBe(403);
    });

    it.each(['localhost:4000', '127.0.0.1:4000', '127.0.0.1'])(
      'should answer 200 when the Host is %s',
      async (loopback) => {
        const response = await app.request('/a/T/_status', { headers: { Host: loopback } });

        expect(response.status).toBe(200);
      },
    );
  });

  describe('PUT /:token/_state', () => {
    const put = (headers: Record<string, string>, body = '{"q":1}') =>
      app.request('/a/T/_state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      });

    it.each([{ Host: host, Origin: 'http://evil.example' }, { Host: host }])(
      'should answer 403 and keep the state when the Origin is wrong or missing: %j',
      async (headers) => {
        const response = await put(headers);

        expect(response.status).toBe(403);
        expect(() => readFileSync(join(directory, 'state.json'))).toThrow();
      },
    );

    it('should store the state when the Origin is the page origin', async () => {
      const response = await put(validHeaders);

      expect(response.status).toBeLessThan(300);
      expect(readFileSync(join(directory, 'state.json'), 'utf8')).toBe('{"q":1}');
    });

    it('should answer 400 and keep the state when the body is not JSON', async () => {
      const response = await put(validHeaders, 'not json');

      expect(response.status).toBe(400);
      expect(() => readFileSync(join(directory, 'state.json'))).toThrow();
    });

    it('should store the state when the page is busy', async () => {
      ticketRunLookup.latestRun = { id: 'r2', state: 'running' };

      expect((await put(validHeaders)).status).toBeLessThan(300);
    });
  });

  describe('GET /:token/_state', () => {
    it('should answer null when no draft was stored', async () => {
      const response = await app.request('/a/T/_state', { headers: { Host: host } });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('null');
    });

    it('should answer the stored draft when a new app instance serves the same files', async () => {
      await app.request('/a/T/_state', {
        method: 'PUT',
        headers: { ...validHeaders, 'Content-Type': 'application/json' },
        body: '{"answers":{"q1":"yes"}}',
      });

      const restarted = buildApp(database, ticketRunLookup);
      const response = await restarted.request('/a/T/_state', { headers: { Host: host } });

      expect(await response.text()).toBe('{"answers":{"q1":"yes"}}');
    });
  });

  describe('GET /:token/_status', () => {
    it('should answer the status and version when the publishing run waits on the page', async () => {
      const waiting: TicketLatestRun = {
        id: 'r1',
        state: 'running',
        waitingFor: { artifactId: 'plan' },
      };
      ticketRunLookup.latestRun = waiting;

      const response = await app.request('/a/T/_status', { headers: { Host: host } });

      expect(await response.json()).toEqual({ status: 'open', version: 1 });
    });
  });
});
