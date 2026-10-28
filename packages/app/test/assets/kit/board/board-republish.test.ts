// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStore } from '../../../../assets/kit/board/board-store.js';
import { pageSession } from '../../../../assets/kit/support/page-session.js';
import { ArtifactService } from '../../../../src/modules/artifacts/business/service/artifact-service.js';
import { FakeArtifactFiles } from '../../../../src/modules/artifacts/testing/fake-artifact-files.js';
import { FakeRunPort } from '../../../../src/modules/artifacts/testing/fake-run-port.js';
import { InMemoryArtifactRepository } from '../../../../src/modules/artifacts/testing/in-memory-artifact-repository.js';
import { FakeClock } from '../../../../src/shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../src/shared/testing/fake-event-publisher.js';
import { FakeAisf, settle, startPage } from '../fakes/fake-aisf.js';
import { buildIndex } from './fake-board-server.js';

const directory = '/w/.aisf/artifacts/design';
const PAST_SAVE_DELAY_MILLISECONDS = 600;

describe('a republished design board', () => {
  let aisf: FakeAisf;
  let files: FakeArtifactFiles;
  let service: ArtifactService;
  let changes: EventTarget;
  let store: BoardStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    aisf = new FakeAisf();
    startPage(aisf);
    files = new FakeArtifactFiles();
    files.files.set(`${directory}/index.json`, JSON.stringify(buildIndex({ round: 3 })));
    service = new ArtifactService({
      artifactRepository: new InMemoryArtifactRepository(),
      artifactFiles: files,
      runPort: new FakeRunPort(),
      events: new FakeEventPublisher(),
      identifiers: { next: () => 'T' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    });
    changes = new EventTarget();
    store = new BoardStore({
      session: pageSession(),
      fetch: async () => new Response(files.files.get(`${directory}/index.json`), { status: 200 }),
      openChanges: () => changes,
    });
    await store.start();
    await settle();
  });
  afterEach(() => vi.useRealTimers());

  it('should give the turn back and move the message to earlier rounds when the session republishes after a message-only round', async () => {
    store.update({ message: 'Why two columns?', sentRound: 3 });
    await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MILLISECONDS);
    files.files.set(`${directory}/user-input-state.json`, JSON.stringify(aisf.lastSave));
    expect(store.mode).toBe('revising');

    await service.publish({
      projectId: 'o/n',
      ticketNumber: 7,
      runId: 'r1',
      worktreePath: '/w',
      artifactId: 'design',
      title: 'Design · round 3',
    });
    changes.dispatchEvent(
      new MessageEvent('reload', { data: JSON.stringify({ file: 'index.json' }) }),
    );
    await settle();

    expect(store.mode).toBe('yourTurn');
    expect(store.get()).toMatchObject({
      earlierMessages: [{ round: 3, text: 'Why two columns?' }],
      pins: [],
      message: '',
    });
  });
});
