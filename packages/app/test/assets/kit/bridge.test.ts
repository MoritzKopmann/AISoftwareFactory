// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StatusEvent = { status: 'open' | 'busy' | 'closed'; version: number };
type Aisf = {
  userInputState: { load(): Promise<unknown>; save(value: unknown): Promise<void> };
  on(event: 'status', listener: (event: StatusEvent) => void): void;
  send(event: {
    kind: string;
    round: number;
    payload: unknown;
  }): Promise<{ ok: true } | { ok: false; status: 'busy' | 'closed' }>;
};

const bridgeSource = readFileSync(
  resolve(import.meta.dirname, '../../../assets/kit/bridge.js'),
  'utf8',
);

function aisf(): Aisf {
  return (window as unknown as { aisf: Aisf }).aisf;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('bridge.js', () => {
  let statuses: StatusEvent[];
  let stateOnServer: unknown;
  let eventsResponse: Response;
  let saveStatus: number | 'network-error';
  let fetchMock: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  async function loadBridge(): Promise<void> {
    new Function(bridgeSource)();
    await vi.advanceTimersByTimeAsync(0);
  }

  async function pollOnce(): Promise<void> {
    await vi.advanceTimersByTimeAsync(3000);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    statuses = [{ status: 'open', version: 1 }];
    stateOnServer = null;
    saveStatus = 200;
    eventsResponse = new Response(null, { status: 201 });
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === './_status') {
        return json(statuses.length > 1 ? statuses.shift() : statuses[0]);
      }
      if (url === './_events') {
        return eventsResponse;
      }
      if (url === './_user-input-state' && init?.method === 'PUT') {
        if (saveStatus === 'network-error') throw new TypeError('network down');
        return new Response(null, { status: saveStatus });
      }
      if (url === './_user-input-state') {
        return json(stateOnServer);
      }
      return new Response(null, { status: 404 });
    });
    reload = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { reload });
    document.documentElement.removeAttribute('data-aisf-status');
    document.body.removeAttribute('inert');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('aisf.userInputState', () => {
    it('should send the value to ./_user-input-state and load what ./_user-input-state answers when a draft is saved and loaded', async () => {
      await loadBridge();
      stateOnServer = { q1: 'yes' };

      await aisf().userInputState.save({ q1: 'yes' });
      const loaded = await aisf().userInputState.load();

      expect(fetchMock).toHaveBeenCalledWith(
        './_user-input-state',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: '{"q1":"yes"}',
        }),
      );
      expect(loaded).toEqual({ q1: 'yes' });
    });

    it('should resolve to null when the server has no draft', async () => {
      await loadBridge();

      expect(await aisf().userInputState.load()).toBeNull();
    });

    it.each([500, 'network-error' as const])(
      'should reject when the save fails with %s',
      async (failure) => {
        await loadBridge();
        saveStatus = failure;

        await expect(aisf().userInputState.save({ a: 1 })).rejects.toThrow();
      },
    );
  });

  describe('status polling', () => {
    it('should call the listener once and mark the page when the first status arrives at load', async () => {
      const listener = vi.fn();
      new Function(bridgeSource)();
      aisf().on('status', listener);
      await vi.advanceTimersByTimeAsync(0);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ status: 'open', version: 1 });
      expect(document.documentElement.getAttribute('data-aisf-status')).toBe('open');
    });

    it('should call a listener that registers after the first status with that status', async () => {
      await loadBridge();
      const listener = vi.fn();

      aisf().on('status', listener);

      expect(listener).toHaveBeenCalledWith({ status: 'open', version: 1 });
    });

    it('should notify only when status or version changes on later polls', async () => {
      const listener = vi.fn();
      new Function(bridgeSource)();
      aisf().on('status', listener);
      await vi.advanceTimersByTimeAsync(0);
      statuses = [
        { status: 'open', version: 1 },
        { status: 'busy', version: 1 },
      ];

      await pollOnce();
      expect(listener).toHaveBeenCalledTimes(1);
      await pollOnce();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ status: 'busy', version: 1 });
      expect(document.documentElement.getAttribute('data-aisf-status')).toBe('busy');
    });

    it('should reload when the version changes on a poll', async () => {
      await loadBridge();
      statuses = [{ status: 'open', version: 2 }];

      await pollOnce();

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('should freeze the body and keep polling when the status turns closed', async () => {
      await loadBridge();
      statuses = [{ status: 'closed', version: 1 }];

      await pollOnce();

      expect(document.documentElement.getAttribute('data-aisf-status')).toBe('closed');
      expect(document.body.hasAttribute('inert')).toBe(true);
      expect(reload).not.toHaveBeenCalled();

      statuses = [{ status: 'closed', version: 2 }];
      await pollOnce();

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('should unfreeze the body when a closed page becomes open without a new version', async () => {
      await loadBridge();
      statuses = [{ status: 'closed', version: 1 }];
      await pollOnce();
      statuses = [{ status: 'open', version: 1 }];

      await pollOnce();

      expect(document.body.hasAttribute('inert')).toBe(false);
    });

    it('should keep polling when a status request fails', async () => {
      await loadBridge();
      fetchMock.mockRejectedValueOnce(new TypeError('network down'));
      await pollOnce();
      statuses = [{ status: 'busy', version: 1 }];

      await pollOnce();

      expect(document.documentElement.getAttribute('data-aisf-status')).toBe('busy');
    });
  });

  describe('aisf.send', () => {
    it('should post the event to ./_events and resolve ok when the server answers 201', async () => {
      await loadBridge();

      const result = await aisf().send({ kind: 'submit', round: 2, payload: { a: 1 } });

      expect(fetchMock).toHaveBeenCalledWith(
        './_events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"kind":"submit","round":2,"payload":{"a":1}}',
        }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('should close the page and tell the listeners when the server answers 409 closed', async () => {
      const listener = vi.fn();
      await loadBridge();
      aisf().on('status', listener);
      eventsResponse = json({ status: 'closed' }, 409);

      const result = await aisf().send({ kind: 'submit', round: 2, payload: {} });

      expect(result).toEqual({ ok: false, status: 'closed' });
      expect(document.documentElement.getAttribute('data-aisf-status')).toBe('closed');
      expect(document.body.hasAttribute('inert')).toBe(true);
      expect(listener).toHaveBeenLastCalledWith({ status: 'closed', version: 1 });
    });

    it('should keep the page usable and the draft when the server answers 409 busy', async () => {
      await loadBridge();
      stateOnServer = { q1: 'draft' };
      eventsResponse = json({ status: 'busy' }, 409);

      const result = await aisf().send({ kind: 'submit', round: 2, payload: {} });

      expect(result).toEqual({ ok: false, status: 'busy' });
      expect(document.body.hasAttribute('inert')).toBe(false);
      expect(await aisf().userInputState.load()).toEqual({ q1: 'draft' });
      expect(fetchMock).not.toHaveBeenCalledWith(
        './_user-input-state',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('should reject when the server answers another error', async () => {
      await loadBridge();
      eventsResponse = new Response(null, { status: 413 });

      await expect(aisf().send({ kind: 'submit', round: 2, payload: {} })).rejects.toThrow();
    });
  });

  describe('aisf.on', () => {
    it('should throw when the event is not status', async () => {
      await loadBridge();

      expect(() =>
        (aisf() as unknown as { on(e: string, l: () => void): void }).on('x', () => {}),
      ).toThrow();
    });
  });
});
