import type { RepositoryWatch } from './repository-watch.js';

export type SnapshotRuleInput = {
  readonly feedsChanged: boolean;
  readonly watch: RepositoryWatch;
  readonly now: string;
  readonly snapshotIntervalMilliseconds: number;
};
