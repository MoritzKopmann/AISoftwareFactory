import type { SyncFailureCause } from './sync-status.js';

export type WatchFailure = {
  readonly cause: SyncFailureCause;
  readonly message: string;
  readonly failedAt: string;
  readonly retryAt?: string;
};
