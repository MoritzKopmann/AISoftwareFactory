import { describe, expect, it } from 'vitest';
import type { SessionEntry } from '../../business/domain/types/session-entry.js';
import type { SessionFeedEvent } from '../../business/port/session/session-feed.js';
import { InMemorySessionFeed } from './in-memory-session-feed.js';

const entry: SessionEntry = { kind: 'text', id: 'u1#0', text: 'Hello' };

describe('InMemorySessionFeed', () => {
  it('should deliver published events in order and keep only entries when a subscriber listens', () => {
    const feed = new InMemorySessionFeed();
    const received: SessionFeedEvent[] = [];
    feed.subscribe('r1', (event) => received.push(event));

    feed.publish('r1', { kind: 'entry', entry });
    feed.publish('r1', { kind: 'text-delta', opensBlock: true, text: 'Hi' });

    expect(received).toEqual([
      { kind: 'entry', entry },
      { kind: 'text-delta', opensBlock: true, text: 'Hi' },
    ]);
    expect(feed.entries('r1')).toEqual([entry]);
  });

  it('should stop delivering when the subscriber unsubscribes', () => {
    const feed = new InMemorySessionFeed();
    const received: SessionFeedEvent[] = [];
    const unsubscribe = feed.subscribe('r1', (event) => received.push(event));
    unsubscribe();

    feed.publish('r1', { kind: 'entry', entry });

    expect(received).toEqual([]);
  });

  it('should not deliver events of another run when two runs publish', () => {
    const feed = new InMemorySessionFeed();
    const received: SessionFeedEvent[] = [];
    feed.subscribe('r1', (event) => received.push(event));

    feed.publish('r2', { kind: 'entry', entry });

    expect(received).toEqual([]);
    expect(feed.entries('r1')).toEqual([]);
  });

  it('should be active from the first publish until end', () => {
    const feed = new InMemorySessionFeed();
    expect(feed.isActive('r1')).toBe(false);

    feed.publish('r1', { kind: 'text-delta', opensBlock: true, text: 'a' });
    expect(feed.isActive('r1')).toBe(true);

    feed.end('r1');
    expect(feed.isActive('r1')).toBe(false);
  });

  it('should send ended and drop entries and listeners when the run ends', () => {
    const feed = new InMemorySessionFeed();
    const received: SessionFeedEvent[] = [];
    feed.subscribe('r1', (event) => received.push(event));
    feed.publish('r1', { kind: 'entry', entry });

    feed.end('r1');

    expect(received).toEqual([{ kind: 'entry', entry }, { kind: 'ended' }]);
    expect(feed.entries('r1')).toEqual([]);
  });
});
