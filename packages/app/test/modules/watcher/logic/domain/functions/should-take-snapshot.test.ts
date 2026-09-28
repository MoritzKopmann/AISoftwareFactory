import { describe, expect, it } from 'vitest';
import { shouldTakeSnapshot } from '../../../../../../src/modules/watcher/logic/domain/functions/should-take-snapshot.js';
import type { RepositoryWatch } from '../../../../../../src/modules/watcher/logic/domain/types/repository-watch.js';

const now = '2026-09-28T12:00:00.000Z';
const snapshotIntervalMilliseconds = 300_000;
const takenAt = '2026-09-28T11:58:00.000Z';

const watchWithSnapshot: RepositoryWatch = {
  projectId: 'owner/name',
  repository: { owner: 'owner', name: 'name' },
  snapshot: { takenAt, openTickets: [], recentlyClosedTickets: [], closedTotalCount: 0 },
  sync: { state: 'ok', checkedAt: takenAt, snapshotTakenAt: takenAt },
};

function decide(feedsChanged: boolean, watch: RepositoryWatch, at = now): boolean {
  return shouldTakeSnapshot({ feedsChanged, watch, now: at, snapshotIntervalMilliseconds });
}

describe('shouldTakeSnapshot', () => {
  it('should take a snapshot when a feed changed', () => {
    expect(decide(true, watchWithSnapshot)).toBe(true);
  });

  it('should take a snapshot when the repository has none yet', () => {
    const pendingWatch: RepositoryWatch = {
      projectId: 'owner/name',
      repository: { owner: 'owner', name: 'name' },
      sync: { state: 'pending' },
    };

    expect(decide(false, pendingWatch)).toBe(true);
  });

  it('should take a snapshot when the last poll failed', () => {
    const failedWatch: RepositoryWatch = {
      ...watchWithSnapshot,
      sync: { state: 'failed', cause: 'unavailable', message: 'down', failedAt: takenAt },
    };

    expect(decide(false, failedWatch)).toBe(true);
  });

  it('should take a snapshot when the safety-net interval has passed', () => {
    expect(decide(false, watchWithSnapshot, '2026-09-28T12:03:00.000Z')).toBe(true);
  });

  it('should skip the snapshot when nothing changed and the interval has not passed', () => {
    expect(decide(false, watchWithSnapshot)).toBe(false);
  });
});
