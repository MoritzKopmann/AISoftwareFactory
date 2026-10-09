import { describe, expect, it } from 'vitest';
import { subscribeLiveConnection } from '../../src/live/subscribe-live-connection.js';
import type { LiveConnection, LiveSignal, LiveUpdates } from '../../src/live/live-updates.js';

describe('subscribeLiveConnection', () => {
  it('should report the new connection when a connection signal arrives', () => {
    let listener: (signal: LiveSignal) => void = () => {};
    const liveUpdates: LiveUpdates = {
      listen: (next) => {
        listener = next;
        return () => {};
      },
      connection: () => 'open',
    };
    const seen: LiveConnection[] = [];
    subscribeLiveConnection(liveUpdates, () => seen.push(liveUpdates.connection()));

    listener({ kind: 'notice', notice: { event: 'watch.updated' } });
    expect(seen).toEqual([]);
    listener({ kind: 'connection', connection: 'offline' });

    expect(seen).toHaveLength(1);
  });
});
