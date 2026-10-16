// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactService } from '../../../src/modules/artifacts/business/service/artifact-service.js';
import { PageService } from '../../../src/modules/artifacts/business/service/page-service.js';
import { createPageRoutes } from '../../../src/modules/artifacts/presentation/api/create-page-routes.js';
import type { TicketLatestRun } from '../../../src/modules/artifacts/business/domain/types/ticket-latest-run.js';
import { FakeEventPublisher } from '../../../src/shared/testing/fake-event-publisher.js';
import { FakeClock } from '../../../src/shared/testing/fake-clock.js';
import { FakeArtifactFiles } from '../../../src/modules/artifacts/testing/fake-artifact-files.js';
import { FakeSchedulerPort } from '../../../src/modules/artifacts/testing/fake-scheduler-port.js';
import { FakeRunPort } from '../../../src/modules/artifacts/testing/fake-run-port.js';
import { InMemoryArtifactRepository } from '../../../src/modules/artifacts/testing/in-memory-artifact-repository.js';

const bridgeSource = readFileSync(
  resolve(import.meta.dirname, '../../../assets/kit/bridge.js'),
  'utf8',
);

describe('a republished page', () => {
  let publish: () => Promise<{ token: string; version: number }>;
  let runPort: FakeRunPort;
  let reload: ReturnType<typeof vi.fn>;
  let app: Hono;

  beforeEach(() => {
    vi.useFakeTimers();
    const artifactRepository = new InMemoryArtifactRepository();
    const artifactFiles = new FakeArtifactFiles();
    runPort = new FakeRunPort();
    const artifactService = new ArtifactService({
      artifactRepository,
      artifactFiles,
      runPort,
      events: new FakeEventPublisher(),
      identifiers: { next: () => 'T' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    });
    artifactFiles.files.set(
      '/w/.aisf/artifacts/plan-round/index.html',
      '<html><body></body></html>',
    );
    publish = () =>
      artifactService.publish({
        projectId: 'o/n',
        ticketNumber: 7,
        runId: 'r1',
        worktreePath: '/w',
        artifactId: 'plan-round',
        title: 'Plan',
      });
    app = new Hono().route(
      '/a',
      createPageRoutes(
        new PageService({
          artifactRepository,
          artifactFiles,
          runPort,
          schedulerPort: new FakeSchedulerPort(),
        }),
      ),
    );
    reload = vi.fn();
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      app.request(`/a/T/${url.replace('./', '')}`, {
        ...init,
        headers: { Host: '127.0.0.1:4000', Origin: 'http://127.0.0.1:4000' },
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function loadPage(): Promise<void> {
    const page = await app.request('/a/T/', { headers: { Host: '127.0.0.1:4000' } });
    expect(page.status).toBe(200);
    new Function(bridgeSource)();
    await vi.advanceTimersByTimeAsync(0);
  }

  it('should keep the token, report version 2 and reload an open tab on its next poll when the artifact is republished', async () => {
    const first = await publish();
    runPort.latestRun = buildWaiting();
    await loadPage();

    const second = await publish();
    await vi.advanceTimersByTimeAsync(3000);

    expect(second.token).toBe(first.token);
    expect(second.version).toBe(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should still reload a closed tab on its next poll when the artifact is republished', async () => {
    await publish();
    runPort.latestRun = undefined;
    await loadPage();
    expect(document.documentElement.getAttribute('data-aisf-status')).toBe('closed');

    await publish();
    await vi.advanceTimersByTimeAsync(3000);

    expect(reload).toHaveBeenCalledTimes(1);
  });
});

function buildWaiting(): TicketLatestRun {
  return { id: 'r1', state: 'running', waitingFor: { artifactId: 'plan-round' } };
}
