// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampZoom,
  fitZoom,
  isHitEnabled,
  keyZoom,
  mountBoardCanvas,
  toBoardPoint,
  wheelZoom,
} from '../../../../assets/kit/board/board-canvas.js';
import { BoardStore } from '../../../../assets/kit/board/board-store.js';
import { pageSession } from '../../../../assets/kit/support/page-session.js';
import { $, $$, FakeAisf, settle, startPage } from '../fakes/fake-aisf.js';
import { FakeBoardServer, buildIndex } from './fake-board-server.js';

const boardHtml = readFileSync(
  resolve(import.meta.dirname, '../../../../assets/kit/board.html'),
  'utf8',
);

const twoBoards = buildIndex({
  boards: [
    { id: 'settings', title: 'Default', w: 880, h: 560, note: 'Settings with three projects.' },
    { id: 'settings-empty', title: 'No projects yet', w: 880, h: 560, note: 'First visit.' },
  ],
});

const thisRoundPin = { n: 1, board: 'settings', theme: 'light', x: 212, y: 148, text: 'Tighter' };

describe('board canvas', () => {
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
    server.index = twoBoards;
  });
  afterEach(() => vi.useRealTimers());

  /** Builds the store after the test set its draft: the page session reads the draft once. */
  const mount = (): void => {
    store = new BoardStore({ session: pageSession(), ...server.dependencies() });
    mountBoardCanvas(document, store);
  };

  const load = async (): Promise<void> => {
    mount();
    await store.start();
    await settle();
  };

  const frame = (boardId: string, theme: string): HTMLElement =>
    $(`.canvas-frame[data-board="${boardId}"][data-theme="${theme}"]`);

  const hitButton = (boardId: string, theme: string): HTMLButtonElement =>
    $<HTMLButtonElement>('.canvas-hit', frame(boardId, theme));

  const markers = (boardId: string, theme: string): HTMLElement[] =>
    $$('.canvas-pin', frame(boardId, theme));

  it('should show each board’s number, title, size, note and a Light and a Dark frame when the page loads', async () => {
    await load();

    const sections = $$('.canvas-section');
    expect(sections).toHaveLength(2);
    expect($$('.canvas-num').map((num) => num.textContent)).toEqual(['01', '02']);
    expect($('.canvas-title', sections[0]).textContent).toBe('Default');
    expect($('.canvas-dims', sections[0]).textContent).toBe('880 × 560');
    expect($('.canvas-note', sections[0]).textContent).toBe('Settings with three projects.');
    expect($$('.canvas-frame-label', sections[0]).map((label) => label.textContent)).toEqual([
      'Light',
      'Dark',
    ]);
    const documentFrame = $<HTMLIFrameElement>('iframe', frame('settings', 'dark'));
    expect(documentFrame.getAttribute('src')).toBe('boards/settings.html');
    expect(documentFrame.title).toBe('Default, dark');
  });

  it('should set data-theme on each board document when it loads', async () => {
    await load();
    const light = $<HTMLIFrameElement>('iframe', frame('settings', 'light'));
    const dark = $<HTMLIFrameElement>('iframe', frame('settings', 'dark'));
    for (const board of [light, dark]) {
      board.contentDocument?.append(board.contentDocument.createElement('html'));
    }

    light.dispatchEvent(new Event('load'));
    dark.dispatchEvent(new Event('load'));

    expect(light.contentDocument?.documentElement.dataset['theme']).toBe('light');
    expect(dark.contentDocument?.documentElement.dataset['theme']).toBe('dark');
  });

  it('should label the canvas for zooming when it mounts', () => {
    mount();

    const main = $('#board-canvas');

    expect(main.tabIndex).toBe(0);
    expect(main.getAttribute('aria-label')).toBe('Boards. Ctrl or Command plus scroll to zoom.');
  });

  it('should fit the zoom and size each frame when the canvas is 1280 wide', async () => {
    Object.defineProperty($('#board-canvas'), 'clientWidth', { value: 1280 });

    await load();

    expect(store.get().zoom).toBe(0.7);
    expect(frame('settings', 'light').style.width).toBe('616px');
    expect(frame('settings', 'light').style.height).toBe('392px');
  });

  it('should keep a zoom already set when the index loads', async () => {
    mount();
    store.update({ zoom: 1 });

    await store.start();
    await settle();

    expect(store.get().zoom).toBe(1);
    expect(frame('settings', 'light').style.width).toBe('880px');
  });

  it('should zoom out to 0.41 and stop the page zoom when Ctrl + wheel moves down by 100', async () => {
    await load();
    store.update({ zoom: 0.5 });
    const wheel = new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, cancelable: true });

    $('#board-canvas').dispatchEvent(wheel);

    expect(store.get().zoom).toBe(0.41);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('should leave the zoom alone when the wheel moves without Ctrl or Command', async () => {
    await load();
    store.update({ zoom: 0.5 });
    const wheel = new WheelEvent('wheel', { deltaY: 100, cancelable: true });

    $('#board-canvas').dispatchEvent(wheel);

    expect(store.get().zoom).toBe(0.5);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('should zoom in by 1.1 when Command + plus is pressed on the canvas', async () => {
    await load();
    store.update({ zoom: 0.5 });
    const key = new KeyboardEvent('keydown', { key: '+', metaKey: true, cancelable: true });

    $('#board-canvas').dispatchEvent(key);

    expect(store.get().zoom).toBe(0.55);
    expect(key.defaultPrevented).toBe(true);
  });

  it('should add a pin and a your-turn marker when commenting and the Light frame is clicked', async () => {
    await load();
    store.update({ zoom: 0.5, commenting: true, refused: 'busy' });
    const hit = hitButton('settings', 'light');
    Object.defineProperty(hit, 'offsetWidth', { value: 440 });
    hit.getBoundingClientRect = () => new DOMRect(100, 50, 440, 280);

    hit.dispatchEvent(new MouseEvent('click', { clientX: 206, clientY: 124, bubbles: true }));
    await settle();

    expect(store.get().pins).toEqual([
      { n: 1, board: 'settings', theme: 'light', x: 212, y: 148, text: '' },
    ]);
    expect(store.get().refused).toBeNull();
    const [marker] = markers('settings', 'light');
    expect(marker?.textContent).toBe('1');
    expect(marker?.dataset['tone']).toBe('hitl');
    expect(marker?.style.left).toBe('106px');
    expect(marker?.style.top).toBe('74px');
    expect(markers('settings', 'dark')).toEqual([]);
  });

  it('should disable the hit button and add nothing when commenting is off', async () => {
    await load();

    hitButton('settings', 'light').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(hitButton('settings', 'light').disabled).toBe(true);
    expect(store.get().pins).toEqual([]);
  });

  it('should disable the hit button when commenting is on but the page is revising', async () => {
    aisf.draft = { rounds: {}, board: { sentRound: 1 } };
    await load();

    store.update({ commenting: true });

    expect(store.isInputOn).toBe(false);
    expect(hitButton('settings', 'light').disabled).toBe(true);
  });

  it('should enable the hit button with its label when commenting and input are on', async () => {
    await load();

    store.update({ commenting: true });

    expect(hitButton('settings', 'dark').disabled).toBe(false);
    expect(hitButton('settings', 'dark').getAttribute('aria-label')).toBe(
      'Place a pin on Default, dark',
    );
  });

  it('should mute this round’s markers when the page is revising', async () => {
    aisf.draft = { rounds: {}, board: { pins: [thisRoundPin], sentRound: 1 } };

    await load();

    expect(markers('settings', 'light').map((marker) => marker.dataset['tone'])).toEqual(['muted']);
  });

  it('should draw no marker for an earlier-round pin when the page loads', async () => {
    const earlierPin = { ...thisRoundPin, theme: 'dark', round: 1 };
    aisf.draft = { rounds: {}, board: { pins: [], earlier: [earlierPin] } };

    await load();

    expect(markers('settings', 'dark')).toEqual([]);
  });

  it('should clear the markers when the index round rises past the sent round', async () => {
    aisf.draft = { rounds: {}, board: { pins: [thisRoundPin], sentRound: 1 } };
    server.index = { ...twoBoards, round: 1 };
    await load();
    expect(markers('settings', 'light')).toHaveLength(1);

    server.index = { ...twoBoards, round: 2 };
    server.reload('index.json');
    await settle();

    expect(markers('settings', 'light')).toEqual([]);
  });

  it('should reload both frames of a board and show Updated when its file changes', async () => {
    await load();
    const before = $$('iframe');
    expect($$('.canvas-updated')).toEqual([]);

    server.reload('boards/settings.html');
    await settle();

    const after = $$('iframe');
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[2]).toBe(before[2]);
    expect(after[0]?.getAttribute('src')).toBe('boards/settings.html');
    const updated = $$('.canvas-updated');
    expect(updated.map((chip) => chip.closest('.canvas-section'))).toEqual([
      $$('.canvas-section')[0],
    ]);
    expect(updated[0]?.textContent).toBe('Updated');
  });
});

describe('clampZoom', () => {
  it.each([
    { zoom: 0.1, clamped: 0.25 },
    { zoom: 0.25, clamped: 0.25 },
    { zoom: 0.6977, clamped: 0.7 },
    { zoom: 2, clamped: 2 },
    { zoom: 2.5, clamped: 2 },
    { zoom: Infinity, clamped: 2 },
  ])('should give $clamped when the zoom is $zoom', ({ zoom, clamped }) => {
    const result = clampZoom(zoom);

    expect(result).toBe(clamped);
  });
});

describe('fitZoom', () => {
  it('should fit two frames of the widest board when the canvas is 1280 wide', () => {
    const boards = [
      { w: 880, h: 560 },
      { w: 390, h: 844 },
    ];

    const zoom = fitZoom(1280, boards);

    expect(zoom).toBe(0.7);
  });

  it('should stop at 0.25 when the canvas is narrower than its padding', () => {
    const zoom = fitZoom(0, [{ w: 880 }]);

    expect(zoom).toBe(0.25);
  });
});

describe('wheelZoom', () => {
  it('should give 0.41 when the zoom is 0.5 and the wheel moves down by 100', () => {
    const zoom = wheelZoom(0.5, 100);

    expect(zoom).toBe(0.41);
  });

  it('should start from 0.5 when the zoom is not set yet', () => {
    const zoom = wheelZoom(null, 100);

    expect(zoom).toBe(0.41);
  });

  it('should stop at 2 when the wheel moves far up', () => {
    const zoom = wheelZoom(1.9, -1000);

    expect(zoom).toBe(2);
  });
});

describe('keyZoom', () => {
  it.each([
    { key: '+', zoom: 0.55 },
    { key: '=', zoom: 0.55 },
    { key: '-', zoom: 0.45 },
  ])('should give $zoom when the zoom is 0.5 and the key is $key', ({ key, zoom }) => {
    const result = keyZoom(0.5, key);

    expect(result).toBe(zoom);
  });

  it('should stop at 0.25 when minus is pressed at 0.25', () => {
    const zoom = keyZoom(0.25, '-');

    expect(zoom).toBe(0.25);
  });

  it('should give undefined when the key is not a zoom key', () => {
    const zoom = keyZoom(0.5, 'a');

    expect(zoom).toBeUndefined();
  });
});

describe('toBoardPoint', () => {
  it('should give board pixels when the frame is clicked at zoom 0.5', () => {
    const box = { left: 100, top: 50, width: 440, offsetWidth: 440 };

    const point = toBoardPoint({ clientX: 206, clientY: 124 }, box, 0.5);

    expect(point).toEqual({ x: 212, y: 148 });
  });

  it('should undo an outer scale when the rect is smaller than the layout size', () => {
    const box = { left: 0, top: 0, width: 220, offsetWidth: 440 };

    const point = toBoardPoint({ clientX: 53, clientY: 37 }, box, 0.5);

    expect(point).toEqual({ x: 212, y: 148 });
  });
});

describe('isHitEnabled', () => {
  it.each([
    { commenting: true, inputOn: true, enabled: true },
    { commenting: false, inputOn: true, enabled: false },
    { commenting: true, inputOn: false, enabled: false },
    { commenting: false, inputOn: false, enabled: false },
  ])(
    'should be $enabled when commenting is $commenting and input is $inputOn',
    ({ commenting, inputOn, enabled }) => {
      const result = isHitEnabled(commenting, inputOn);

      expect(result).toBe(enabled);
    },
  );
});
