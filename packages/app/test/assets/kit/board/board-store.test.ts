// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStore } from '../../../../assets/kit/board/board-store.js';
import { pageSession } from '../../../../assets/kit/support/page-session.js';
import { FakeAisf, settle, startPage } from '../fakes/fake-aisf.js';
import { FakeBoardServer, buildIndex } from './fake-board-server.js';

const PAST_SAVE_DELAY_MILLISECONDS = 600;

describe('BoardStore', () => {
  let aisf: FakeAisf;
  let server: FakeBoardServer;
  let store: BoardStore;

  beforeEach(() => {
    vi.useFakeTimers();
    aisf = new FakeAisf();
    startPage(aisf);
    server = new FakeBoardServer();
  });
  afterEach(() => vi.useRealTimers());

  const start = async (): Promise<void> => {
    store = new BoardStore({ session: pageSession(), ...server.dependencies() });
    await store.start();
    await settle();
  };

  it('should hold the index when index.json loads', async () => {
    server.index = buildIndex({ title: 'Project settings', round: 2 });

    await start();

    expect(store.get().index).toEqual(buildIndex({ title: 'Project settings', round: 2 }));
    expect(server.requests).toEqual(['./index.json']);
  });

  it('should be missing when index.json returns 404', async () => {
    server.index = undefined;

    await start();

    expect(store.get().index).toBe('missing');
    expect(store.mode).toBe('missing');
  });

  it('should restore every draft field when a saved draft exists', async () => {
    const pin = { n: 1, board: 'settings', theme: 'light', x: 10, y: 20, text: 'Tighter' };
    const earlier = { ...pin, n: 2, round: 1 };
    aisf.draft = {
      rounds: {},
      board: {
        pins: [pin],
        message: 'Looks close',
        earlier: [earlier],
        updated: ['settings'],
        sentRound: 1,
        acceptedRound: null,
      },
    };
    server.index = buildIndex({ round: 1 });

    await start();

    expect(store.get()).toMatchObject({
      pins: [pin],
      message: 'Looks close',
      earlier: [earlier],
      updated: ['settings'],
      sentRound: 1,
      acceptedRound: null,
    });
  });

  it.each([
    { sentRound: null, acceptedRound: null, mode: 'yourTurn' },
    { sentRound: 2, acceptedRound: null, mode: 'revising' },
    { sentRound: 3, acceptedRound: null, mode: 'revising' },
    { sentRound: null, acceptedRound: 2, mode: 'accepted' },
    { sentRound: 2, acceptedRound: 2, mode: 'accepted' },
  ])(
    'should be $mode when sentRound is $sentRound and acceptedRound is $acceptedRound at round 2',
    async ({ sentRound, acceptedRound, mode }) => {
      aisf.draft = { rounds: {}, board: { sentRound, acceptedRound } };
      server.index = buildIndex({ round: 2 });

      await start();

      expect(store.mode).toBe(mode);
    },
  );

  it('should turn input off and tell subscribers when the bridge reports closed', async () => {
    await start();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.isInputOn).toBe(true);

    aisf.emitStatus('closed');

    expect(store.get().status).toBe('closed');
    expect(store.isInputOn).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it('should keep input off when the mode is not your turn', async () => {
    aisf.draft = { rounds: {}, board: { acceptedRound: 1 } };

    await start();

    expect(store.isInputOn).toBe(false);
  });

  it('should save the draft under board when an update changes a draft field', async () => {
    await start();

    store.update({ message: 'Make it denser' });
    await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MILLISECONDS);

    expect(aisf.lastSave).toMatchObject({ board: { message: 'Make it denser', pins: [] } });
  });

  it('should not save when an update changes only page fields', async () => {
    await start();

    store.update({ zoom: 1, commenting: true });
    await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MILLISECONDS);

    expect(aisf.saves).toEqual([]);
  });

  it('should mark the board updated and keep it after a page reload when its file changes', async () => {
    await start();

    server.reload('boards/settings.html');
    server.reload('boards/settings.html');
    await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MILLISECONDS);
    expect(server.changeUrls).toEqual(['./_changes']);
    expect(store.get().updated).toEqual(['settings']);
    aisf.draft = aisf.lastSave;
    startPage(aisf);
    await start();

    expect(store.get().updated).toEqual(['settings']);
  });

  it('should re-read the index when index.json changes', async () => {
    await start();
    server.index = buildIndex({ title: 'Renamed' });

    server.reload('index.json');
    await settle();

    expect(store.get().index).toMatchObject({ title: 'Renamed' });
    expect(server.requests).toEqual(['./index.json', './index.json']);
  });

  it('should move this round’s pins to earlier and return to your turn when a higher round arrives', async () => {
    const earlierPin = {
      n: 1,
      board: 'settings',
      theme: 'light',
      x: 1,
      y: 2,
      text: 'Older',
      round: 1,
    };
    const pin = { n: 2, board: 'settings', theme: 'dark', x: 3, y: 4, text: 'Bigger' };
    aisf.draft = {
      rounds: {},
      board: { pins: [pin], message: 'See pins', earlier: [earlierPin], sentRound: 2 },
    };
    server.index = buildIndex({ round: 2 });
    await start();
    expect(store.mode).toBe('revising');
    server.index = buildIndex({ round: 3 });

    server.reload('index.json');
    await vi.advanceTimersByTimeAsync(PAST_SAVE_DELAY_MILLISECONDS);

    expect(store.mode).toBe('yourTurn');
    expect(store.get()).toMatchObject({
      pins: [],
      message: '',
      sentRound: null,
      earlier: [earlierPin, { ...pin, round: 2 }],
    });
    expect(aisf.lastSave).toMatchObject({ board: { earlier: [earlierPin, { ...pin, round: 2 }] } });
  });

  it('should apply the round rise on load when the index is already past the sent round', async () => {
    const pin = { n: 1, board: 'settings', theme: 'light', x: 1, y: 2, text: 'Nudge' };
    aisf.draft = { rounds: {}, board: { pins: [pin], sentRound: 1 } };
    server.index = buildIndex({ round: 2 });

    await start();

    expect(store.get()).toMatchObject({
      pins: [],
      sentRound: null,
      earlier: [{ ...pin, round: 1 }],
    });
  });

  it('should start with an empty draft when nothing was saved', async () => {
    await start();

    expect(store.get()).toMatchObject({
      pins: [],
      message: '',
      earlier: [],
      updated: [],
      sentRound: null,
      acceptedRound: null,
      zoom: null,
      commenting: false,
      confirming: false,
      refused: null,
      status: 'open',
    });
  });
});
