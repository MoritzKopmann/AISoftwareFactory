import type { RepositoryWatch } from '../types/repository-watch.js';
import type { SyncStatus } from '../types/sync-status.js';
import { diffSnapshots } from './diff-snapshots.js';
import { hasSnapshotChanges } from './has-snapshot-changes.js';

/** True when the sync status or the tickets differ. Poll timestamps are ignored. */
export function hasWatchChanged(previous: RepositoryWatch, next: RepositoryWatch): boolean {
  if (!hasSameSync(previous.sync, next.sync)) {
    return true;
  }
  if (next.snapshot === undefined) {
    return previous.snapshot !== undefined;
  }
  return hasSnapshotChanges(diffSnapshots(previous.snapshot, next.snapshot));
}

function hasSameSync(left: SyncStatus, right: SyncStatus): boolean {
  if (left.state === 'failed' && right.state === 'failed') {
    return (
      left.cause === right.cause && left.message === right.message && left.retryAt === right.retryAt
    );
  }
  return left.state === right.state && left.state !== 'failed';
}
