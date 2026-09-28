import type { SnapshotRuleInput } from '../types/snapshot-rule-input.js';

export function shouldTakeSnapshot(input: SnapshotRuleInput): boolean {
  const { snapshot } = input.watch;
  return (
    input.feedsChanged ||
    snapshot === undefined ||
    input.watch.sync.state === 'failed' ||
    Date.parse(input.now) - Date.parse(snapshot.takenAt) >= input.snapshotIntervalMilliseconds
  );
}
