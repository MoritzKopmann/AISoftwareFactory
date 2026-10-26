// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeChip, mountBoardShell } from '../../../../assets/kit/board/board-shell.js';
import { BoardStore } from '../../../../assets/kit/board/board-store.js';
import { pageSession } from '../../../../assets/kit/support/page-session.js';
import { $, FakeAisf, click, settle, startPage } from '../fakes/fake-aisf.js';
import { FakeBoardServer, buildIndex } from './fake-board-server.js';

const boardHtml = readFileSync(
  resolve(import.meta.dirname, '../../../../assets/kit/board.html'),
  'utf8',
);

const isVisible = (selector: string): boolean => !$(selector).hidden;

describe('board shell', () => {
  let aisf: FakeAisf;
  let server: FakeBoardServer;
  let store: BoardStore;

  beforeEach(() => {
    vi.useFakeTimers();
    aisf = new FakeAisf();
    startPage(aisf);
    document.body.innerHTML = new DOMParser().parseFromString(
      boardHtml,
      'text/html',
    ).body.innerHTML;
    server = new FakeBoardServer();
    store = new BoardStore({ session: pageSession(), ...server.dependencies() });
    mountBoardShell(document, store);
  });
  afterEach(() => vi.useRealTimers());

  const load = async (): Promise<void> => {
    await store.start();
    await settle();
  };

  it('should show the title, round, zoom and your-turn chip when the index loads', async () => {
    server.index = buildIndex({ title: 'Project settings', round: 2 });

    await load();

    expect($('.board-title').textContent).toBe('Project settings');
    expect($('.board-round').textContent).toBe('Round 2');
    expect($('.board-zoom').textContent).toBe('Zoom 50%');
    expect($('.board-chip').textContent).toBe('Your turn');
    expect($('.board-chip').dataset['tone']).toBe('hitl');
    expect(isVisible('.board-body')).toBe(true);
    expect(isVisible('.board-loading')).toBe(false);
  });

  it('should show only Design and the loading block when the index has not loaded yet', () => {
    expect($('.board-title').textContent).toBe('Design');
    expect(isVisible('.board-loading')).toBe(true);
    for (const part of ['.board-round', '.board-zoom', '.board-chip', '.board-body']) {
      expect(isVisible(part)).toBe(false);
    }
  });

  it('should show Design and the missing block when index.json returns 404', async () => {
    server.index = undefined;

    await load();

    expect($('.board-title').textContent).toBe('Design');
    expect(isVisible('.board-missing')).toBe(true);
    expect(isVisible('.board-loading')).toBe(false);
    expect(isVisible('.board-chip')).toBe(false);
  });

  it('should show the Closed chip and the banner when the bridge reports closed', async () => {
    await load();

    aisf.emitStatus('closed');

    expect($('.board-chip').textContent).toBe('Closed');
    expect($('.board-chip').dataset['tone']).toBe('muted');
    expect(isVisible('.board-banner')).toBe(true);
  });

  it('should read Zoom 100% with its label when the zoom button is clicked at 0.5', async () => {
    await load();

    await click($('.board-zoom'));

    expect(store.get().zoom).toBe(1);
    expect($('.board-zoom').textContent).toBe('Zoom 100%');
    expect($('.board-zoom').getAttribute('aria-label')).toBe('Zoom 100%. Reset to 100%.');
  });
});

describe('describeChip', () => {
  it.each([
    { status: 'closed', mode: 'accepted', label: 'Closed', tone: 'muted' },
    { status: 'closed', mode: 'revising', label: 'Closed', tone: 'muted' },
    { status: 'open', mode: 'revising', label: 'Session is revising…', tone: 'warn' },
    { status: 'busy', mode: 'accepted', label: 'Accepted', tone: 'ok' },
    { status: 'open', mode: 'yourTurn', label: 'Your turn', tone: 'hitl' },
  ] as const)(
    'should read $label when the status is $status and the mode is $mode',
    ({ status, mode, label, tone }) => {
      const chip = describeChip(status, mode);

      expect(chip).toEqual({ label, tone });
    },
  );
});
