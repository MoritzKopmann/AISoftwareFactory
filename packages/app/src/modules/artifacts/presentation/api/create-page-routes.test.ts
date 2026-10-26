import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageRoutes } from './create-page-routes.js';
import type { TicketLatestRun } from '../../business/domain/types/ticket-latest-run.js';
import { PageBusyError } from '../../business/errors/page-busy-error.js';
import { PageService } from '../../business/service/page-service.js';
import { buildArtifact } from '../../testing/build-artifact.js';
import { FakeArtifactFiles } from '../../testing/fake-artifact-files.js';
import { FakeSchedulerPort } from '../../testing/fake-scheduler-port.js';
import { FakeDesignWatcher } from '../../testing/fake-design-watcher.js';
import { FakeRunPort } from '../../testing/fake-run-port.js';
import { InMemoryArtifactRepository } from '../../testing/in-memory-artifact-repository.js';

const directory = '/worktrees/n/7/.aisf/artifacts/plan';

const host = '127.0.0.1:4000';
const hostHeaders = { Host: host };

function buildApp(
  artifactRepository: InMemoryArtifactRepository,
  artifactFiles: FakeArtifactFiles,
  runPort: FakeRunPort,
  schedulerPort: FakeSchedulerPort,
  designWatcher = new FakeDesignWatcher(),
): Hono {
  return new Hono().route(
    '/a',
    createPageRoutes(
      new PageService({
        artifactRepository,
        artifactFiles,
        runPort,
        schedulerPort,
        designWatcher,
      }),
    ),
  );
}

function readerOf(response: Response): ReadableStreamDefaultReader<Uint8Array> {
  if (response.body === null) {
    throw new Error('The response has no body');
  }
  return response.body.getReader();
}

describe('createPageRoutes', () => {
  let artifactRepository: InMemoryArtifactRepository;
  let artifactFiles: FakeArtifactFiles;
  let runPort: FakeRunPort;
  let schedulerPort: FakeSchedulerPort;
  let app: Hono;

  beforeEach(() => {
    artifactFiles = new FakeArtifactFiles();
    artifactFiles.files.set(
      `${directory}/index.html`,
      '<!doctype html><html><head><title>Plan</title><script>window.a = 1;</script></head><body><script src="app.js"></script></body></html>',
    );
    artifactFiles.files.set(`${directory}/app.js`, 'console.log(1);');
    artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ directory }));
    runPort = new FakeRunPort();
    schedulerPort = new FakeSchedulerPort();
    app = buildApp(artifactRepository, artifactFiles, runPort, schedulerPort);
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
      expect(html).toContain(
        `src="/aisf/bridge.js"></script><script type="module" nonce="${nonce}" src="/aisf/kit.js">`,
      );
      const scripts = html.match(/<script[^>]*>/g) ?? [];
      expect(scripts).toHaveLength(4);
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
        `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src http://127.0.0.1:4000/a/T/; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`,
      );
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('should allow the app to frame the page when it is served', async () => {
      const response = await app.request('/a/T/', { headers: { Host: host } });

      expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'self'");
      expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
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

    it.each(['/a/T/../secret', '/a/T/%2e%2e/secret', '/a/T/..%2Fsecret', '/a/T/missing.js'])(
      'should answer 404 when %s names no file of the page',
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
      ['GET', '/a/unknown/_user-input-state'],
      ['PUT', '/a/unknown/_user-input-state'],
    ])('should answer 404 when %s %s is requested', async (method, path) => {
      const response = await app.request(path, {
        method,
        headers: hostHeaders,
        ...(method === 'PUT' ? { body: '{}' } : {}),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /:token/_user-input-state', () => {
    const put = (headers: Record<string, string>, body = '{"q":1}') =>
      app.request('/a/T/_user-input-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      });

    it('should store the state when the body is JSON', async () => {
      const response = await put(hostHeaders);

      expect(response.status).toBeLessThan(300);
      expect(artifactFiles.files.get(`${directory}/user-input-state.json`)).toBe('{"q":1}');
    });

    it('should answer 400 and keep the state when the body is not JSON', async () => {
      const response = await put(hostHeaders, 'not json');

      expect(response.status).toBe(400);
      expect(artifactFiles.files.has(`${directory}/user-input-state.json`)).toBe(false);
    });

    it('should store the state when the page is busy', async () => {
      runPort.latestRun = { id: 'r2', worktreePath: '/w', state: 'running' };

      expect((await put(hostHeaders)).status).toBeLessThan(300);
    });
  });

  describe('GET /:token/_user-input-state', () => {
    it('should answer null when no draft was stored', async () => {
      const response = await app.request('/a/T/_user-input-state', { headers: { Host: host } });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('null');
    });

    it('should answer the stored draft when a new app instance serves the same files', async () => {
      await app.request('/a/T/_user-input-state', {
        method: 'PUT',
        headers: { ...hostHeaders, 'Content-Type': 'application/json' },
        body: '{"answers":{"q1":"yes"}}',
      });

      const restarted = buildApp(artifactRepository, artifactFiles, runPort, schedulerPort);
      const response = await restarted.request('/a/T/_user-input-state', {
        headers: { Host: host },
      });

      expect(await response.text()).toBe('{"answers":{"q1":"yes"}}');
    });
  });

  describe('POST /:token/_events', () => {
    const waiting: TicketLatestRun = {
      id: 'r1',
      worktreePath: '/w',
      state: 'running',
      waitingFor: { artifactId: 'plan' },
    };

    function post(body: string, headers: Record<string, string> = hostHeaders, token = 'T') {
      return app.request(`/a/${token}/_events`, { method: 'POST', headers, body });
    }

    const submit = JSON.stringify({ kind: 'submit', round: 2, payload: { a: 1 } });

    it('should answer 201 and deliver one tagged event when the run waits on the page', async () => {
      runPort.latestRun = waiting;

      const response = await post(submit);

      expect(response.status).toBe(201);
      expect(schedulerPort.calls).toEqual([
        { runId: 'r1', text: '<aisf-event artifact=plan kind=submit round=2>{"a":1}</aisf-event>' },
      ]);
    });

    it('should deliver a confirm with its own kind when the run waits on the page', async () => {
      runPort.latestRun = waiting;

      const response = await post(
        JSON.stringify({ kind: 'confirm', round: 3, payload: { confirmed: true } }),
      );

      expect(response.status).toBe(201);
      expect(schedulerPort.calls).toEqual([
        {
          runId: 'r1',
          text: '<aisf-event artifact=plan kind=confirm round=3>{"confirmed":true}</aisf-event>',
        },
      ]);
    });

    it('should answer 201 when the run ended at a checkpoint on the page', async () => {
      runPort.latestRun = {
        id: 'r1',
        worktreePath: '/w',
        state: 'ended',
        ending: { kind: 'checkpoint', artifactId: 'plan' },
      };

      expect((await post(submit)).status).toBe(201);
      expect(schedulerPort.calls).toHaveLength(1);
    });

    it('should answer 409 closed and deliver nothing when the run ended other than at a checkpoint', async () => {
      runPort.latestRun = {
        id: 'r1',
        worktreePath: '/w',
        state: 'ended',
        ending: { kind: 'done' },
      };

      const response = await post(submit);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ status: 'closed' });
      expect(schedulerPort.calls).toEqual([]);
    });

    it('should answer 409 closed when the same submit is posted again after delivery', async () => {
      runPort.latestRun = waiting;
      await post(submit);
      runPort.latestRun = { id: 'r1', worktreePath: '/w', state: 'running' };

      const response = await post(submit);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ status: 'closed' });
      expect(schedulerPort.calls).toHaveLength(1);
    });

    it('should answer 409 busy and deliver nothing when another run is running', async () => {
      runPort.latestRun = { id: 'r2', worktreePath: '/w', state: 'running' };

      const response = await post(submit);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ status: 'busy' });
      expect(schedulerPort.calls).toEqual([]);
    });

    it('should answer 409 busy when the scheduler refuses the answer', async () => {
      runPort.latestRun = waiting;
      schedulerPort.failure = new PageBusyError('refused');

      const response = await post(submit);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ status: 'busy' });
    });

    it('should answer 413 and deliver nothing when the body is over 32 KB', async () => {
      runPort.latestRun = waiting;

      const response = await post(
        JSON.stringify({ kind: 'submit', round: 1, payload: 'x'.repeat(32 * 1024) }),
      );

      expect(response.status).toBe(413);
      expect(schedulerPort.calls).toEqual([]);
    });

    it.each([
      ['no round', '{"kind":"submit","payload":1}'],
      ['a non-integer round', '{"kind":"submit","round":1.5,"payload":1}'],
      ['a round below 1', '{"kind":"submit","round":0,"payload":1}'],
      ['another kind', '{"kind":"delete","round":1,"payload":1}'],
      ['no payload', '{"kind":"submit","round":1}'],
      ['no JSON', 'not json'],
    ])('should answer 400 and deliver nothing when the body has %s', async (_name, body) => {
      runPort.latestRun = waiting;

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(schedulerPort.calls).toEqual([]);
    });

    it('should answer 404 when the token is unknown', async () => {
      expect((await post(submit, hostHeaders, 'unknown-token')).status).toBe(404);
    });
  });

  describe('GET /:token/_status', () => {
    it('should answer the status and version when the publishing run waits on the page', async () => {
      const waiting: TicketLatestRun = {
        id: 'r1',
        worktreePath: '/w',
        state: 'running',
        waitingFor: { artifactId: 'plan' },
      };
      runPort.latestRun = waiting;

      const response = await app.request('/a/T/_status', { headers: { Host: host } });

      expect(await response.json()).toEqual({ status: 'open', version: 1 });
    });
  });

  describe('boards', () => {
    const boardDirectory = '/worktrees/n/7/.aisf/artifacts/design';
    let designWatcher: FakeDesignWatcher;
    let boardApp: Hono;

    beforeEach(() => {
      designWatcher = new FakeDesignWatcher();
      artifactRepository.add(
        buildArtifact({ token: 'B', artifactId: 'design', directory: boardDirectory }),
      );
      boardApp = buildApp(artifactRepository, artifactFiles, runPort, schedulerPort, designWatcher);
    });

    it("should allow frame-src 'self' and no remote origin when the board shell is served", async () => {
      const response = await boardApp.request('/a/B/', { headers: hostHeaders });
      const csp = response.headers.get('Content-Security-Policy') ?? '';

      expect(response.status).toBe(200);
      expect(csp).toContain("frame-src 'self';");
      expect(csp).not.toMatch(/https?:\/\/(?!127\.0\.0\.1:4000)/);
    });

    it('should send no frame-src when a page is served', async () => {
      const response = await boardApp.request('/a/T/', { headers: hostHeaders });

      expect(response.headers.get('Content-Security-Policy')).not.toContain('frame-src');
    });

    it('should stream a reload event when the watcher reports a file', async () => {
      const response = await boardApp.request('/a/B/_changes', { headers: hostHeaders });
      const reader = readerOf(response);
      await vi.waitFor(() => expect(designWatcher.watched).toHaveLength(1));

      designWatcher.emit(boardDirectory, 'boards/home.html');
      const { value } = await reader.read();

      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      expect(new TextDecoder().decode(value)).toBe(
        'event: reload\ndata: {"file":"boards/home.html"}\n\n',
      );
      await reader.cancel();
    });

    it('should stop the watcher when the client disconnects', async () => {
      const response = await boardApp.request('/a/B/_changes', { headers: hostHeaders });
      const reader = readerOf(response);
      await vi.waitFor(() => expect(designWatcher.watched).toHaveLength(1));

      await reader.cancel();

      await vi.waitFor(() => expect(designWatcher.stopped).toBe(1));
    });

    it('should answer 404 when the changes of a page are requested', async () => {
      const response = await boardApp.request('/a/T/_changes', { headers: hostHeaders });

      expect(response.status).toBe(404);
    });

    it('should answer 201 when a design-accepted event is posted', async () => {
      runPort.latestRun = {
        id: 'r1',
        worktreePath: '/w',
        state: 'running',
        waitingFor: { artifactId: 'design' },
      };

      const response = await boardApp.request('/a/B/_events', {
        method: 'POST',
        headers: { ...hostHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'design-accepted', round: 3, payload: { round: 3 } }),
      });

      expect(response.status).toBe(201);
    });
  });
});
