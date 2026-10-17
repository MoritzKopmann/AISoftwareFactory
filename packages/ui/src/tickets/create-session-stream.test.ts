import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';
import { describe, expect, it } from 'vitest';
import type { LiveSignal, LiveStream } from '../live/live-updates.js';
import { createSessionStream } from './create-session-stream.js';
import type { SessionView } from './fold-session-view.js';

class FakeStream implements LiveStream {
  onopen: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 1;
  closed = false;
  constructor(readonly url: string) {}
  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
  send(frame: object): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
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
  const views: SessionView[] = [];
  const visibility = new FakeVisibility();
  const listeners = new Set<(signal: LiveSignal) => void>();
  const frames = new Map<number, () => void>();
  let nextHandle = 1;
  const session = createSessionStream({
    url: '/api/projects/o/n/tickets/7/session',
    projectId: 'o/n',
    ticketNumber: 7,
    openStream: (url) => {
      const stream = new FakeStream(url);
      streams.push(stream);
      return stream;
    },
    visibility,
    liveUpdates: {
      listen: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      connection: () => 'open',
    },
    frames: {
      request: (callback) => {
        frames.set(nextHandle, callback);
        return nextHandle++;
      },
      cancel: (handle) => void frames.delete(handle),
    },
    onChange: (view) => views.push(view),
  });
  const notify = (notice: LiveNotice) =>
    listeners.forEach((listener) => listener({ kind: 'notice', notice }));
  const runFrames = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  return { session, streams, views, visibility, notify, runFrames };
}

describe('createSessionStream', () => {
  it('should open the session url and show the snapshot when it arrives', () => {
    const { streams, views } = build();
    streams[0]?.send({ kind: 'snapshot', entries: [{ kind: 'prompt', id: 'a', text: 'Hi' }] });
    expect(streams[0]?.url).toBe('/api/projects/o/n/tickets/7/session');
    expect(views.at(-1)).toMatchObject({ kind: 'entries', entries: [{ id: 'a' }] });
  });

  it('should update the view once holding all deltas when three deltas arrive before the next frame', () => {
    const { streams, views, runFrames } = build();
    streams[0]?.send({ kind: 'snapshot', entries: [] });
    const before = views.length;
    streams[0]?.send({ kind: 'delta', opensBlock: true, text: 'a' });
    streams[0]?.send({ kind: 'delta', opensBlock: false, text: 'b' });
    streams[0]?.send({ kind: 'delta', opensBlock: false, text: 'c' });
    expect(views).toHaveLength(before);
    runFrames();
    expect(views).toHaveLength(before + 1);
    expect(views.at(-1)).toMatchObject({ openText: 'abc' });
  });

  it('should apply waiting deltas before an entry when an entry arrives within a frame', () => {
    const { streams, views } = build();
    streams[0]?.send({ kind: 'snapshot', entries: [] });
    streams[0]?.send({ kind: 'delta', opensBlock: true, text: 'Hel' });
    streams[0]?.send({ kind: 'entry', entry: { kind: 'text', id: 'b', text: 'Hello' } });
    const last = views.at(-1);
    expect(last).toMatchObject({ entries: [{ id: 'b' }] });
    expect(last && 'openText' in last && last.openText).toBeFalsy();
  });

  it('should close the stream and keep the entries when ended arrives', () => {
    const { streams, views } = build();
    streams[0]?.send({ kind: 'snapshot', entries: [{ kind: 'prompt', id: 'a', text: 'Hi' }] });
    streams[0]?.send({ kind: 'ended' });
    expect(streams[0]?.closed).toBe(true);
    expect(views.at(-1)).toMatchObject({ entries: [{ id: 'a' }], ended: true });
  });

  it('should open the stream again when run.started for this ticket arrives after ended', () => {
    const { streams, notify } = build();
    streams[0]?.send({ kind: 'ended' });
    notify({ event: 'run.started', projectId: 'o/n', ticketNumber: 7 });
    expect(streams).toHaveLength(2);
    expect(streams[0]?.closed).toBe(true);
    expect(streams[1]?.closed).toBe(false);
  });

  it('should ignore run.started when it is for another ticket', () => {
    const { streams, notify } = build();
    streams[0]?.send({ kind: 'ended' });
    notify({ event: 'run.started', projectId: 'o/n', ticketNumber: 8 });
    expect(streams).toHaveLength(1);
  });

  it('should close then re-open when the tab becomes hidden then visible', () => {
    const { streams, visibility } = build();
    visibility.set('hidden');
    expect(streams[0]?.closed).toBe(true);
    visibility.set('visible');
    expect(streams).toHaveLength(2);
  });

  it('should stay closed when the tab becomes visible after ended', () => {
    const { streams, visibility } = build();
    streams[0]?.send({ kind: 'ended' });
    visibility.set('hidden');
    visibility.set('visible');
    expect(streams).toHaveLength(1);
  });

  it('should show the empty state when no-session arrives', () => {
    const { streams, views } = build();
    streams[0]?.send({ kind: 'no-session' });
    expect(views.at(-1)).toEqual({ kind: 'no-session' });
  });

  it('should ignore a message that is not a known frame', () => {
    const { streams, views } = build();
    streams[0]?.onmessage?.({ data: 'nope' });
    streams[0]?.send({ kind: 'bogus' });
    expect(views).toHaveLength(0);
  });

  it('should close the stream and drop the listeners when closed', () => {
    const { session, streams, visibility, notify } = build();
    session.close();
    expect(streams[0]?.closed).toBe(true);
    visibility.set('hidden');
    visibility.set('visible');
    notify({ event: 'run.started', projectId: 'o/n', ticketNumber: 7 });
    expect(streams).toHaveLength(1);
  });

  describe('connection loss', () => {
    const snapshot = { kind: 'snapshot', entries: [{ kind: 'prompt', id: 'a', text: 'Hi' }] };

    it('should emit a lost view with the entries when the stream errors while retrying', () => {
      const { streams, views } = build();
      streams[0]?.send(snapshot);
      if (streams[0]) streams[0].readyState = 0;
      streams[0]?.onerror?.({});
      expect(views.at(-1)).toMatchObject({
        kind: 'entries',
        entries: [{ id: 'a' }],
        connectionLost: true,
      });
    });

    it('should clear the flag when a snapshot arrives after a drop', () => {
      const { streams, views } = build();
      streams[0]?.send(snapshot);
      if (streams[0]) streams[0].readyState = 0;
      streams[0]?.onerror?.({});
      streams[0]?.send({ kind: 'snapshot', entries: [{ kind: 'prompt', id: 'b', text: 'Yo' }] });
      expect(views.at(-1)).toMatchObject({ entries: [{ id: 'b' }], connectionLost: false });
    });

    it('should stay waiting when the stream errors before any frame', () => {
      const { streams, views } = build();
      if (streams[0]) streams[0].readyState = 0;
      streams[0]?.onerror?.({});
      expect(views).toHaveLength(0);
    });

    it('should stay no-session when the stream errors on a message view', () => {
      const { streams, views } = build();
      streams[0]?.send({ kind: 'no-session' });
      if (streams[0]) streams[0].readyState = 0;
      streams[0]?.onerror?.({});
      expect(views).toEqual([{ kind: 'no-session' }]);
    });

    it('should not emit a lost view when the tab is hidden and the closed stream errors', () => {
      const { streams, views, visibility } = build();
      streams[0]?.send(snapshot);
      visibility.set('hidden');
      streams[0]?.onerror?.({});
      expect(views.some((view) => view.kind === 'entries' && view.connectionLost)).toBe(false);
    });

    it('should not emit a lost view when the closed stream errors after ended', () => {
      const { streams, views } = build();
      streams[0]?.send(snapshot);
      streams[0]?.send({ kind: 'ended' });
      streams[0]?.onerror?.({});
      expect(views.some((view) => view.kind === 'entries' && view.connectionLost)).toBe(false);
    });

    it('should emit once when the stream errors again while retrying', () => {
      const { streams, views } = build();
      streams[0]?.send(snapshot);
      if (streams[0]) streams[0].readyState = 0;
      streams[0]?.onerror?.({});
      const count = views.length;
      streams[0]?.onerror?.({});
      expect(views).toHaveLength(count);
    });

    it('should apply waiting deltas before the flag when the stream errors', () => {
      const { streams, views } = build();
      streams[0]?.send(snapshot);
      streams[0]?.send({ kind: 'delta', opensBlock: true, text: 'abc' });
      if (streams[0]) streams[0].readyState = 0;
      streams[0]?.onerror?.({});
      expect(views.at(-1)).toMatchObject({ openText: 'abc', connectionLost: true });
    });

    it('should release the stream and open a new one when the browser gave up', () => {
      const { streams, visibility } = build();
      streams[0]?.send(snapshot);
      if (streams[0]) streams[0].readyState = 2;
      streams[0]?.onerror?.({});
      visibility.set('hidden');
      visibility.set('visible');
      expect(streams[0]?.closed).toBe(true);
      expect(streams).toHaveLength(2);
      expect(streams[1]?.url).toBe('/api/projects/o/n/tickets/7/session');
    });
  });
});
