import type { SnapshotDiff } from '../types/snapshot-diff.js';

export function hasSnapshotChanges(diff: SnapshotDiff): boolean {
  return (
    diff.addedTicketNumbers.length > 0 ||
    diff.changedTicketNumbers.length > 0 ||
    diff.removedTicketNumbers.length > 0
  );
}
