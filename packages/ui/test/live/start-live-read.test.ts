import { describe, expect, it } from 'vitest';
import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';
import { startLiveRead } from '../../src/live/start-live-read.js';
import type { LiveSignal, LiveUpdates } from '../../src/live/live-updates.js';
import type { LiveView } from '../../src/live/notice-concerns-view.js';

class FakeLiveUpdates implements LiveUpdates {
  listeners = new Set<(signal: LiveSignal) => void>();
  listen(listener: (signal: LiveSignal) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  connection() {
    return 'open' as const;
  }
  send(signal: LiveSignal): void {
    this.listeners.forEach((listener) => listener(signal));
  }
  notice(notice: LiveNotice): void {
    this.send({ kind: 'notice', notice });
  }
}

type Pending = { resolve: (value: number) => void; reject: (error: Error) => void };

function build(view: LiveView) {
  const liveUpdates = new FakeLiveUpdates();
  const pending: Pending[] = [];
  const outcomes: number[] = [];
  const reader = startLiveRead(
    liveUpdates,
    view,
    () => new Promise<number>((resolve, reject) => pending.push({ resolve, reject })),
    (outcome) => outcomes.push(outcome),
  );
  const settle = async (index: number, value: number) => {
    pending[index]?.resolve(value);
    await Promise.resolve();
    await Promise.resolve();
  };
  return { liveUpdates, pending, outcomes, reader, settle };
}

const run7: LiveView = { kind: 'run', projectId: 'octo/repo', ticketNumber: 7 };
const step = (ticketNumber: number): LiveNotice => ({
  event: 'run.step-added',
  projectId: 'octo/repo',
  ticketNumber,
});

describe('startLiveRead', () => {
  it('should read on mount and again only for a concerning notice', async () => {
    const { liveUpdates, pending, outcomes, settle } = build(run7);
    expect(pending).toHaveLength(1);
    await settle(0, 1);

    liveUpdates.notice(step(8));
    expect(pending).toHaveLength(1);
    liveUpdates.notice(step(7));
    expect(pending).toHaveLength(2);
    await settle(1, 2);

    expect(outcomes).toEqual([1, 2]);
  });

  it('should read once per mounted view when opened arrives', async () => {
    const liveUpdates = new FakeLiveUpdates();
    let boardReads = 0;
    let findingsReads = 0;
    startLiveRead(
      liveUpdates,
      { kind: 'board', projectId: 'octo/repo' },
      async () => ++boardReads,
      () => {},
    );
    startLiveRead(
      liveUpdates,
      { kind: 'findings', projectId: 'octo/repo' },
      async () => ++findingsReads,
      () => {},
    );
    await Promise.resolve();
    await Promise.resolve();

    liveUpdates.send({ kind: 'opened' });

    expect([boardReads, findingsReads]).toEqual([2, 2]);
  });

  it('should start exactly one more read when a burst arrives during a read', async () => {
    const { liveUpdates, pending, settle } = build(run7);

    liveUpdates.notice(step(7));
    liveUpdates.notice(step(7));
    liveUpdates.notice(step(7));
    expect(pending).toHaveLength(1);
    await settle(0, 1);

    expect(pending).toHaveLength(2);
    await settle(1, 2);
    expect(pending).toHaveLength(2);
  });

  it('should deliver outcomes in read order so an older answer never overwrites a newer one', async () => {
    const { liveUpdates, outcomes, settle } = build(run7);
    liveUpdates.notice(step(7));

    await settle(0, 10);
    await settle(1, 20);

    expect(outcomes.at(-1)).toBe(20);
  });

  it('should read again when retry is called after a failed read', async () => {
    const { pending, reader } = build(run7);
    pending[0]?.reject(new Error('down'));
    await Promise.resolve();
    await Promise.resolve();

    reader.retry();

    expect(pending).toHaveLength(2);
  });

  it('should not read or deliver after stop', async () => {
    const { liveUpdates, pending, outcomes, reader, settle } = build(run7);

    reader.stop();
    await settle(0, 1);
    liveUpdates.notice(step(7));

    expect(outcomes).toEqual([]);
    expect(pending).toHaveLength(1);
  });
});
