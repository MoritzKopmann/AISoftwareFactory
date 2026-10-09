import { describe, expect, it } from 'vitest';
import { hasWatchChanged } from '../../../../../../src/modules/watcher/logic/domain/functions/has-watch-changed.js';
import type { RepositoryWatch } from '../../../../../../src/modules/watcher/logic/domain/types/repository-watch.js';
import type { TicketSnapshot } from '../../../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import { buildTicket } from '../../../fakes/build-ticket.js';

const repository = { owner: 'octo', name: 'repo' };

function snapshot(
  takenAt: string,
  tickets: ReadonlyArray<ReturnType<typeof buildTicket>>,
): TicketSnapshot {
  return { takenAt, openTickets: tickets, recentlyClosedTickets: [], closedTotalCount: 0 };
}

function okWatch(checkedAt: string, tickets: ReadonlyArray<ReturnType<typeof buildTicket>>) {
  const taken = snapshot('2026-09-28T12:00:00.000Z', tickets);
  return {
    projectId: 'octo/repo',
    repository,
    snapshot: taken,
    sync: { state: 'ok', checkedAt, snapshotTakenAt: taken.takenAt },
  } satisfies RepositoryWatch;
}

describe('hasWatchChanged', () => {
  it('should return false when only checkedAt and snapshotTakenAt differ', () => {
    const previous = okWatch('2026-09-28T12:00:00.000Z', [buildTicket({ number: 1 })]);
    const next = {
      ...okWatch('2026-09-28T12:00:30.000Z', [buildTicket({ number: 1 })]),
      snapshot: snapshot('2026-09-28T12:00:30.000Z', [buildTicket({ number: 1 })]),
    };
    expect(hasWatchChanged(previous, next)).toBe(false);
  });

  it('should return true when a ticket differs, is new or is gone', () => {
    const previous = okWatch('2026-09-28T12:00:00.000Z', [buildTicket({ number: 1 })]);
    const changed = okWatch('2026-09-28T12:00:00.000Z', [
      buildTicket({ number: 1, status: 'ready' }),
    ]);
    const added = okWatch('2026-09-28T12:00:00.000Z', [
      buildTicket({ number: 1 }),
      buildTicket({ number: 2 }),
    ]);
    const removed = okWatch('2026-09-28T12:00:00.000Z', []);
    expect([changed, added, removed].map((next) => hasWatchChanged(previous, next))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should return true when the previous state is pending, even with no tickets', () => {
    const previous: RepositoryWatch = {
      projectId: 'octo/repo',
      repository,
      sync: { state: 'pending' },
    };
    expect(hasWatchChanged(previous, okWatch('2026-09-28T12:00:00.000Z', []))).toBe(true);
  });

  it('should return true when the watch recovers from a failure with the same tickets', () => {
    const ok = okWatch('2026-09-28T12:00:00.000Z', [buildTicket({ number: 1 })]);
    const failed: RepositoryWatch = {
      ...ok,
      sync: {
        state: 'failed',
        cause: 'unavailable',
        message: 'down',
        failedAt: '2026-09-28T12:00:00.000Z',
        snapshotTakenAt: '2026-09-28T12:00:00.000Z',
      },
    };
    expect(hasWatchChanged(failed, ok)).toBe(true);
    expect(hasWatchChanged(ok, failed)).toBe(true);
  });

  it('should return false when the same failure repeats with a later failedAt', () => {
    const failure = {
      state: 'failed',
      cause: 'rate-limited',
      message: 'limit',
      retryAt: '2026-09-28T12:10:00.000Z',
    } as const;
    const previous: RepositoryWatch = {
      projectId: 'octo/repo',
      repository,
      sync: { ...failure, failedAt: '2026-09-28T12:00:00.000Z' },
    };
    const next: RepositoryWatch = {
      ...previous,
      sync: { ...failure, failedAt: '2026-09-28T12:01:00.000Z' },
    };
    expect(hasWatchChanged(previous, next)).toBe(false);
  });

  it('should return true when the failure message, cause or retryAt differs', () => {
    const base = {
      state: 'failed',
      cause: 'unavailable',
      message: 'a',
      failedAt: '2026-09-28T12:00:00.000Z',
    } as const;
    const previous: RepositoryWatch = { projectId: 'octo/repo', repository, sync: base };
    const withSync = (sync: RepositoryWatch['sync']): RepositoryWatch => ({ ...previous, sync });
    expect(hasWatchChanged(previous, withSync({ ...base, message: 'b' }))).toBe(true);
    expect(hasWatchChanged(previous, withSync({ ...base, cause: 'auth' }))).toBe(true);
    expect(
      hasWatchChanged(previous, withSync({ ...base, retryAt: '2026-09-28T12:10:00.000Z' })),
    ).toBe(true);
  });
});
