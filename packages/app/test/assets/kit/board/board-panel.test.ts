// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countUnsent,
  describeUnsent,
  mountBoardPanel,
} from '../../../../assets/kit/board/board-panel.js';
import { BoardStore } from '../../../../assets/kit/board/board-store.js';
import type { Pin } from '../../../../assets/kit/board/board-store.js';
import { pageSession } from '../../../../assets/kit/support/page-session.js';
import { $, $$, FakeAisf, click, settle, startPage, type } from '../fakes/fake-aisf.js';
import { FakeBoardServer, buildIndex } from './fake-board-server.js';

const PAST_SAVE_DELAY_MILLISECONDS = 600;

function buildPin(fields: Partial<Pin> = {}): Pin {
  return { n: 1, board: 'default', theme: 'light', x: 212, y: 148, text: '', ...fields };
}

describe('board panel', () => {
  let aisf: FakeAisf;
  let server: FakeBoardServer;
  let store: BoardStore;

  beforeEach(() => {
    vi.useFakeTimers();
    aisf = new FakeAisf();
    startPage(aisf);
    document.body.innerHTML = '<aside id="board-panel"></aside>';
    server = new FakeBoardServer();
    server.index = buildIndex({
      round: 2,
      brief: 'Settings page for one project.',
      boards: [{ id: 'default', title: 'Default', w: 1280, h: 800, note: '' }],
    });
    store = new BoardStore({ session: pageSession(), ...server.dependencies() });
    mountBoardPanel($('#board-panel'), store, pageSession());
  });
  afterEach(() => vi.useRealTimers());

  const load = async (): Promise<void> => {
    await store.start();
    await settle();
  };

  const findRows = (): HTMLElement[] => $$('.board-pin:not(.board-pin-earlier)');

  it('should show the count, each pin row and the Send count when two pins are placed', async () => {
    await load();

    store.update({ pins: [buildPin(), buildPin({ n: 2, theme: 'dark', x: 640, y: 412 })] });

    expect($('.board-pins-heading').textContent).toBe('This round · 2 pinned');
    expect(findRows().map((row) => $('.board-pin-badge', row).textContent)).toEqual(['1', '2']);
    expect(findRows().map((row) => $('.board-pin-where', row).textContent)).toEqual([
      'Default · light · 212, 148',
      'Default · dark · 640, 412',
    ]);
    expect(findRows().map((row) => $<HTMLTextAreaElement>('textarea', row).disabled)).toEqual([
      false,
      false,
    ]);
    expect($('[aria-label="Remove pin 2"]').textContent).toBe('Remove');
    expect($('.board-send').textContent).toBe('Send feedback (2 pinned)');
  });

  it('should show the empty note and disable Send when there are no pins and no message', async () => {
    await load();

    expect($('.board-pins-empty').textContent).toBe('No pins yet.');
    expect(findSend().disabled).toBe(true);
  });

  it('should enable Send when a message is typed with no pins', async () => {
    await load();

    await type($('.board-message'), 'Make it calmer');

    expect(store.get().message).toBe('Make it calmer');
    expect(findSend().disabled).toBe(false);
  });

  it('should keep Send disabled when the message is only spaces', async () => {
    await load();

    await type($('.board-message'), '   ');

    expect(findSend().disabled).toBe(true);
  });

  it('should write the pin text and save the draft when a comment is typed', async () => {
    await load();
    store.update({ pins: [buildPin()] });

    await type($<HTMLTextAreaElement>('textarea', findRows()[0]), 'Too narrow');
    await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MILLISECONDS);

    expect(store.get().pins[0]?.text).toBe('Too narrow');
    expect(aisf.lastSave).toMatchObject({ board: { pins: [{ text: 'Too narrow' }] } });
  });

  it('should number the rest 1 and 2 when pin 1 of 3 is removed', async () => {
    await load();
    store.update({
      pins: [buildPin({ text: 'a' }), buildPin({ n: 2, text: 'b' }), buildPin({ n: 3, text: 'c' })],
    });

    await click($('[aria-label="Remove pin 1"]'));

    expect(store.get().pins.map((pin) => [pin.n, pin.text])).toEqual([
      [1, 'b'],
      [2, 'c'],
    ]);
    expect(findRows().map((row) => $<HTMLTextAreaElement>('textarea', row).value)).toEqual([
      'b',
      'c',
    ]);
  });

  it('should toggle commenting when Comment on a spot is clicked', async () => {
    await load();

    await click(findToggle());

    expect(store.get().commenting).toBe(true);
    expect(findToggle().getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['c', 'C'])(
    'should toggle commenting when %s is pressed outside a text field',
    async (key) => {
      await load();

      press(document.body, key);

      expect(store.get().commenting).toBe(true);
      expect(findToggle().getAttribute('aria-pressed')).toBe('true');
    },
  );

  it('should leave commenting off when C is pressed inside a textarea', async () => {
    await load();

    press($('.board-message'), 'c');

    expect(store.get().commenting).toBe(false);
  });

  it('should leave commenting off when C is pressed with Ctrl', async () => {
    await load();

    press(document.body, 'c', { ctrlKey: true });

    expect(store.get().commenting).toBe(false);
  });

  it('should send design-feedback with every pin and the message when Send is clicked', async () => {
    await load();
    store.update({
      pins: [buildPin({ text: 'Too narrow' }), buildPin({ n: 2, theme: 'dark', x: 640, y: 412 })],
      message: 'Calmer overall',
    });

    await click(findSend());

    expect(aisf.sent).toEqual([
      {
        kind: 'design-feedback',
        round: 2,
        payload: {
          round: 2,
          comments: [
            { n: 1, board: 'default', theme: 'light', x: 212, y: 148, text: 'Too narrow' },
            { n: 2, board: 'default', theme: 'dark', x: 640, y: 412, text: '' },
          ],
          message: 'Calmer overall',
        },
      },
    ]);
  });

  it('should read sent, lock the fields and clear Updated when the send is delivered', async () => {
    await load();
    store.update({ pins: [buildPin({ text: 'Too narrow' })], updated: ['default'] });
    store.update({ commenting: true });

    await click(findSend());

    expect($('.board-pins-heading').textContent).toBe('This round · sent');
    expect($$<HTMLTextAreaElement>('textarea', $('.board-pin-list'))).toEqual([]);
    expect($('.board-pin-read', findRows()[0]).textContent).toBe('Too narrow');
    expect($$('.board-pin-remove')).toEqual([]);
    expect($<HTMLTextAreaElement>('.board-message').disabled).toBe(true);
    expect(findSend().disabled).toBe(true);
    expect(findAccept().disabled).toBe(true);
    expect(store.get()).toMatchObject({ sentRound: 2, updated: [], commenting: false });
  });

  it.each([
    { status: 'busy', text: 'Not sent: the session is busy. Try again in a moment.' },
    { status: 'closed', text: 'Not sent: this page is closed.' },
  ] as const)('should show "$text" when the bridge answers $status', async ({ status, text }) => {
    await load();
    store.update({ pins: [buildPin({ text: 'Too narrow' })] });
    aisf.sendResult = { ok: false, status };

    await click(findSend());

    expect($('[role="alert"]').textContent).toBe(text);
    expect(store.get()).toMatchObject({ refused: status, sentRound: null });
  });

  it('should keep the pins and message editable when the bridge answers busy', async () => {
    await load();
    store.update({ pins: [buildPin({ text: 'Too narrow' })], message: 'Calmer' });
    aisf.sendResult = { ok: false, status: 'busy' };

    await click(findSend());

    expect($<HTMLTextAreaElement>('textarea', findRows()[0]).value).toBe('Too narrow');
    expect($<HTMLTextAreaElement>('textarea', findRows()[0]).disabled).toBe(false);
    expect($<HTMLTextAreaElement>('.board-message').value).toBe('Calmer');
    expect($<HTMLTextAreaElement>('.board-message').disabled).toBe(false);
  });

  it('should show the no-answer alert when the send rejects', async () => {
    await load();
    store.update({ pins: [buildPin()] });
    aisf.send = async () => Promise.reject(new Error('Sending the event failed: 500'));

    await click(findSend());

    expect($('[role="alert"]').textContent).toBe('Not sent: the app did not answer. Try again.');
  });

  it('should clear the alert when the next pin is placed', async () => {
    await load();
    store.update({ pins: [buildPin()] });
    aisf.sendResult = { ok: false, status: 'busy' };
    await click(findSend());

    store.update({ pins: [buildPin(), buildPin({ n: 2 })] });

    expect(store.get().refused).toBeNull();
    expect($('[role="alert"]').hidden).toBe(true);
  });

  it('should open the confirm with the dropped count when Accept design… is clicked with 2 pins', async () => {
    await load();
    store.update({ pins: [buildPin(), buildPin({ n: 2 })] });

    await click(findAccept());

    expect(findConfirm().hidden).toBe(false);
    expect($('.board-unsent').textContent).toBe('Your 2 unsent comments are dropped.');
    expect(findAccept().disabled).toBe(true);
  });

  it('should hide the dropped warning when nothing is unsent', async () => {
    await load();

    await click(findAccept());

    expect($('.board-unsent').hidden).toBe(true);
  });

  it('should close the confirm when Cancel is clicked', async () => {
    await load();
    await click(findAccept());

    await click($('.board-confirm-cancel'));

    expect(findConfirm().hidden).toBe(true);
    expect(findAccept().disabled).toBe(false);
  });

  it('should send design-accepted and clear the draft when the accept is confirmed', async () => {
    await load();
    store.update({ pins: [buildPin({ text: 'Too narrow' })], message: 'Calmer' });
    await click(findAccept());

    await click($('.board-confirm-accept'));

    expect(aisf.sent).toEqual([{ kind: 'design-accepted', round: 2, payload: { round: 2 } }]);
    expect(store.get()).toMatchObject({
      acceptedRound: 2,
      pins: [],
      message: '',
      confirming: false,
    });
    expect(findAccept().hidden).toBe(true);
  });

  it('should keep the draft and show the alert when the accept is refused as busy', async () => {
    await load();
    store.update({ pins: [buildPin()] });
    aisf.sendResult = { ok: false, status: 'busy' };
    await click(findAccept());

    await click($('.board-confirm-accept'));

    expect($('[role="alert"]').textContent).toBe(
      'Not sent: the session is busy. Try again in a moment.',
    );
    expect(store.get()).toMatchObject({ acceptedRound: null, pins: [buildPin()] });
  });

  it('should list earlier pins read-only with their round, marked done, and no Remove', async () => {
    await load();

    store.update({ earlier: [{ ...buildPin({ x: 440, y: 300, text: 'Add a way' }), round: 1 }] });

    const earlier = $$('.board-pin-earlier');
    expect($('.board-earlier-heading').textContent).toBe('Earlier rounds');
    expect(earlier.map((row) => $('.board-pin-where', row).textContent)).toEqual([
      'Round 1 · Default · light · 440, 300 · Done',
    ]);
    expect($('.board-pin-read', earlier[0]).textContent).toBe('Add a way');
    expect($$('textarea, button', earlier[0])).toEqual([]);
  });

  it('should list an earlier message read-only under Whole design with no field or Remove', async () => {
    await load();

    store.update({ earlierMessages: [{ round: 1, text: 'Make it calmer' }] });

    const earlier = $$('.board-pin-earlier');
    expect($('.board-earlier-heading').textContent).toBe('Earlier rounds');
    expect($('.board-pin-where', earlier[0]).textContent).toBe('Round 1 · Whole design');
    expect($('.board-pin-read', earlier[0]).textContent).toBe('Make it calmer');
    expect($$('textarea, button', earlier[0])).toEqual([]);
  });

  it('should save the sent round before the POST goes out when Send is clicked', async () => {
    await load();
    store.update({ message: 'Make it calmer' });
    let savedAtSend: unknown;
    aisf.send = async () => {
      savedAtSend = aisf.lastSave;
      return { ok: true };
    };

    await click(findSend());

    expect(savedAtSend).toMatchObject({ board: { sentRound: 2, message: 'Make it calmer' } });
  });

  it('should move the sent message to earlier rounds when the board restarts at the next round', async () => {
    await load();
    store.update({ message: 'Make it calmer' });
    await click(findSend());
    aisf.draft = aisf.lastSave;
    server.index = buildIndex({ round: 3 });

    const next = new BoardStore({ session: pageSession(), ...server.dependencies() });
    await next.start();

    expect(next.get()).toMatchObject({
      message: '',
      earlierMessages: [{ round: 2, text: 'Make it calmer' }],
    });
  });

  it('should save sentRound null and keep the draft when the bridge answers busy', async () => {
    await load();
    store.update({ pins: [buildPin({ text: 'Too narrow' })], message: 'Calmer' });
    aisf.sendResult = { ok: false, status: 'busy' };

    await click(findSend());

    expect(aisf.lastSave).toMatchObject({
      board: { sentRound: null, message: 'Calmer', pins: [buildPin({ text: 'Too narrow' })] },
    });
  });

  it.each([
    { name: 'revising', patch: { sentRound: 2 } },
    { name: 'accepted', patch: { acceptedRound: 2 } },
  ])('should turn every input off when the board is $name', async ({ patch }) => {
    await load();
    store.update({ pins: [buildPin()], ...patch });

    expectInputOff();
  });

  it('should turn every input off when the page is closed', async () => {
    await load();
    store.update({ pins: [buildPin()] });

    aisf.emitStatus('closed');

    expectInputOff();
  });

  it('should ignore the C key when input is off', async () => {
    await load();
    aisf.emitStatus('closed');

    press(document.body, 'c');

    expect(store.get().commenting).toBe(false);
  });

  it('should restore the pins, their texts and the message when the page reloads', async () => {
    aisf.draft = {
      rounds: {},
      board: { pins: [buildPin({ text: 'Too narrow' })], message: 'Calmer' },
    };
    startPage(aisf);
    document.body.innerHTML = '<aside id="board-panel"></aside>';
    store = new BoardStore({ session: pageSession(), ...server.dependencies() });
    mountBoardPanel($('#board-panel'), store, pageSession());

    await load();

    expect(findRows().map((row) => $<HTMLTextAreaElement>('textarea', row).value)).toEqual([
      'Too narrow',
    ]);
    expect($<HTMLTextAreaElement>('.board-message').value).toBe('Calmer');
  });

  it('should show the brief from the index', async () => {
    await load();

    expect($('.board-brief-text').textContent).toBe('Settings page for one project.');
  });

  const findSend = (): HTMLButtonElement => $<HTMLButtonElement>('.board-send');
  const findAccept = (): HTMLButtonElement => $<HTMLButtonElement>('.board-accept');
  const findToggle = (): HTMLButtonElement => $<HTMLButtonElement>('.board-toggle');
  const findConfirm = (): HTMLElement => $('.board-confirm');

  const expectInputOff = (): void => {
    expect(findToggle().disabled).toBe(true);
    expect($<HTMLTextAreaElement>('.board-message').disabled).toBe(true);
    expect($$<HTMLTextAreaElement>('textarea', $('.board-pin-list'))).toEqual([]);
    expect($$('.board-pin-remove')).toEqual([]);
    expect(findSend().disabled).toBe(true);
  };
});

describe('describeUnsent', () => {
  it.each([
    { count: 1, text: 'Your 1 unsent comment is dropped.' },
    { count: 2, text: 'Your 2 unsent comments are dropped.' },
  ])('should read "$text" when $count comments are unsent', ({ count, text }) => {
    const warning = describeUnsent(count);

    expect(warning).toBe(text);
  });
});

describe('countUnsent', () => {
  it.each([
    { pinCount: 0, message: '', count: 0 },
    { pinCount: 0, message: ' ', count: 0 },
    { pinCount: 0, message: 'Calmer', count: 1 },
    { pinCount: 2, message: 'Calmer', count: 3 },
  ])(
    'should count $count when there are $pinCount pins and the message is "$message"',
    ({ pinCount, message, count: expectedCount }) => {
      const pins = Array.from({ length: pinCount }, (_, position) => buildPin({ n: position + 1 }));

      const count = countUnsent({ pins, message });

      expect(count).toBe(expectedCount);
    },
  );
});

function press(target: Element, key: string, modifiers: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }));
}
