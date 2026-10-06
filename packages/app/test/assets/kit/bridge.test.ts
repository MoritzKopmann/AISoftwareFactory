// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StatusEvent = { status: 'open' | 'busy' | 'closed'; version: number };
type Aisf = {
  state: { load(): Promise<unknown>; save(value: unknown): Promise<void> };
  on(event: 'status', listener: (event: StatusEvent) => void): void;
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
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === './_status') {
        return json(statuses.length > 1 ? statuses.shift() : statuses[0]);
      }
      if (url === './_state' && init?.method === 'PUT') {
        if (saveStatus === 'network-error') throw new TypeError('network down');
        return new Response(null, { status: saveStatus });
      }
      if (url === './_state') {
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

  describe('aisf.state', () => {
    it('should send the value to ./_state and load what ./_state answers when a draft is saved and loaded', async () => {
      await loadBridge();
      stateOnServer = { q1: 'yes' };

      await aisf().state.save({ q1: 'yes' });
      const loaded = await aisf().state.load();

      expect(fetchMock).toHaveBeenCalledWith(
        './_state',
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

      expect(await aisf().state.load()).toBeNull();
    });

    it.each([500, 'network-error' as const])(
      'should reject when the save fails with %s',
      async (failure) => {
        await loadBridge();
        saveStatus = failure;

        await expect(aisf().state.save({ a: 1 })).rejects.toThrow();
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

  describe('aisf.on', () => {
    it('should throw when the event is not status', async () => {
      await loadBridge();

      expect(() =>
        (aisf() as unknown as { on(e: string, l: () => void): void }).on('x', () => {}),
      ).toThrow();
    });
  });
});
