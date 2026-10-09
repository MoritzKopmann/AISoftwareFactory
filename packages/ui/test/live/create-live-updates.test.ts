import { describe, expect, it } from 'vitest';
import { createLiveUpdates } from '../../src/live/create-live-updates.js';
import type { LiveSignal, LiveStream } from '../../src/live/live-updates.js';

class FakeStream implements LiveStream {
  onopen: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 0;
  closed = false;
  constructor(readonly url: string) {}
  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  fail(readyState: number): void {
    this.readyState = readyState;
    this.onerror?.({});
  }
  receive(data: string): void {
    this.onmessage?.({ data });
  }
}

class FakeVisibility {
  visibilityState = 'visible';
  private listeners: Array<() => void> = [];
  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.push(listener);
  }
  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners = this.listeners.filter((entry) => entry !== listener);
  }
  set(state: string): void {
    this.visibilityState = state;
    this.listeners.forEach((listener) => listener());
  }
}

function build() {
  const streams: FakeStream[] = [];
  const visibility = new FakeVisibility();
  const liveUpdates = createLiveUpdates({
    openStream: (url) => {
      const stream = new FakeStream(url);
      streams.push(stream);
      return stream;
    },
    visibility,
  });
  const signals: LiveSignal[] = [];
  liveUpdates.listen((signal) => signals.push(signal));
  return { liveUpdates, streams, visibility, signals };
}

describe('createLiveUpdates', () => {
  it('should be open and emit opened when the stream fires open', () => {
    const { liveUpdates, streams, signals } = build();
    expect(liveUpdates.connection()).toBe('connecting');

    streams[0]?.open();

    expect(liveUpdates.connection()).toBe('open');
    expect(signals).toContainEqual({ kind: 'opened' });
  });

  it('should go offline on error and reopen with opened when the stream opens again', () => {
    const { liveUpdates, streams, signals } = build();
    streams[0]?.open();
    signals.length = 0;

    streams[0]?.fail(0);
    expect(liveUpdates.connection()).toBe('offline');
    streams[0]?.open();

    expect(liveUpdates.connection()).toBe('open');
    expect(signals).toContainEqual({ kind: 'opened' });
  });

  it('should be offline when the stream errors before any open', () => {
    const { liveUpdates, streams } = build();

    streams[0]?.fail(0);

    expect(liveUpdates.connection()).toBe('offline');
  });

  it('should close the stream and pause when hidden, and open a new stream when visible', () => {
    const { liveUpdates, streams, visibility } = build();
    streams[0]?.open();

    visibility.set('hidden');
    expect(streams[0]?.closed).toBe(true);
    expect(liveUpdates.connection()).toBe('paused');
    visibility.set('visible');

    expect(streams).toHaveLength(2);
    expect(streams[1]?.url).toBe('/api/events');
    expect(liveUpdates.connection()).toBe('connecting');
    streams[1]?.open();
    expect(liveUpdates.connection()).toBe('open');
  });

  it('should open a new stream on the next visible change when the browser gave up', () => {
    const { streams, visibility } = build();
    streams[0]?.open();
    streams[0]?.fail(2);

    visibility.set('hidden');
    visibility.set('visible');

    expect(streams).toHaveLength(2);
  });

  it('should not open a second stream when visible fires while a stream is live', () => {
    const { streams, visibility } = build();
    streams[0]?.open();

    visibility.set('visible');

    expect(streams).toHaveLength(1);
  });

  it('should deliver a notice when the message passes the schema', () => {
    const { streams, signals } = build();
    streams[0]?.open();
    signals.length = 0;

    streams[0]?.receive('{"event":"run.step-added","projectId":"octo/repo","ticketNumber":7}');

    expect(signals).toEqual([
      {
        kind: 'notice',
        notice: { event: 'run.step-added', projectId: 'octo/repo', ticketNumber: 7 },
      },
    ]);
  });

  it('should ignore a message when the data fails the schema or is not JSON', () => {
    const { streams, signals } = build();
    streams[0]?.open();
    signals.length = 0;

    streams[0]?.receive('{"event":"no.such-event"}');
    streams[0]?.receive('not json');

    expect(signals).toEqual([]);
  });

  it('should emit a connection signal when the connection changes', () => {
    const { streams, signals } = build();

    streams[0]?.open();
    streams[0]?.fail(0);

    expect(signals).toContainEqual({ kind: 'connection', connection: 'open' });
    expect(signals).toContainEqual({ kind: 'connection', connection: 'offline' });
  });

  it('should stop signalling a listener after it unlistens', () => {
    const { liveUpdates, streams } = build();
    const seen: LiveSignal[] = [];
    const unlisten = liveUpdates.listen((signal) => seen.push(signal));
    unlisten();

    streams[0]?.open();

    expect(seen).toEqual([]);
  });
});
