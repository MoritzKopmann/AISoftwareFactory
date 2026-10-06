// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageRoutes } from '../../../src/modules/bridge/api/routes/create-page-routes.js';
import type { TicketLatestRun } from '../../../src/modules/bridge/logic/domain/types/ticket-latest-run.js';
import { PublishArtifactUseCase } from '../../../src/modules/bridge/logic/use-cases/publish-artifact-use-case.js';
import { ReadPageAssetUseCase } from '../../../src/modules/bridge/logic/use-cases/read-page-asset-use-case.js';
import { ReadPageStateUseCase } from '../../../src/modules/bridge/logic/use-cases/read-page-state-use-case.js';
import { ReadPageStatusUseCase } from '../../../src/modules/bridge/logic/use-cases/read-page-status-use-case.js';
import { ReadPageUseCase } from '../../../src/modules/bridge/logic/use-cases/read-page-use-case.js';
import { SubmitPageEventUseCase } from '../../../src/modules/bridge/logic/use-cases/submit-page-event-use-case.js';
import { WritePageStateUseCase } from '../../../src/modules/bridge/logic/use-cases/write-page-state-use-case.js';
import { FakeClock } from '../../fakes/fake-clock.js';
import { FakeArtifactFiles } from '../../modules/bridge/fakes/fake-artifact-files.js';
import { FakeCheckpointAnswers } from '../../modules/bridge/fakes/fake-checkpoint-answers.js';
import { FakeTicketRunLookup } from '../../modules/bridge/fakes/fake-ticket-run-lookup.js';
import { InMemoryArtifactRepository } from '../../modules/bridge/fakes/in-memory-artifact-repository.js';

const bridgeSource = readFileSync(
  resolve(import.meta.dirname, '../../../assets/kit/bridge.js'),
  'utf8',
);

describe('a republished page', () => {
  let publish: () => Promise<{ token: string; version: number }>;
  let ticketRunLookup: FakeTicketRunLookup;
  let reload: ReturnType<typeof vi.fn>;
  let app: Hono;

  beforeEach(() => {
    vi.useFakeTimers();
    const artifactRepository = new InMemoryArtifactRepository();
    const artifactFiles = new FakeArtifactFiles();
    ticketRunLookup = new FakeTicketRunLookup();
    const publishArtifact = new PublishArtifactUseCase({
      artifactRepository,
      artifactFiles,
      identifiers: { next: () => 'T' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    });
    artifactFiles.files.set(
      '/w/.aisf/artifacts/plan-round/index.html',
      '<html><body></body></html>',
    );
    publish = () =>
      publishArtifact.execute({
        projectId: 'o/n',
        ticketNumber: 7,
        runId: 'r1',
        worktreePath: '/w',
        artifactId: 'plan-round',
        title: 'Plan',
      });
    app = new Hono().route(
      '/a',
      createPageRoutes({
        readPage: new ReadPageUseCase({ artifactRepository, artifactFiles }),
        readAsset: new ReadPageAssetUseCase({ artifactRepository, artifactFiles }),
        readStatus: new ReadPageStatusUseCase({ artifactRepository, ticketRunLookup }),
        readState: new ReadPageStateUseCase({ artifactRepository, artifactFiles }),
        writeState: new WritePageStateUseCase({ artifactRepository, artifactFiles }),
        submitEvent: new SubmitPageEventUseCase({
          artifactRepository,
          ticketRunLookup,
          checkpointAnswers: new FakeCheckpointAnswers(),
        }),
      }),
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
    ticketRunLookup.latestRun = buildWaiting();
    await loadPage();

    const second = await publish();
    await vi.advanceTimersByTimeAsync(3000);

    expect(second.token).toBe(first.token);
    expect(second.version).toBe(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should still reload a closed tab on its next poll when the artifact is republished', async () => {
    await publish();
    ticketRunLookup.latestRun = undefined;
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
