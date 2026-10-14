export type SyncFailureCause = 'auth' | 'rate-limited' | 'unavailable' | 'unexpected';

export type SyncStatus =
  | { readonly state: 'pending' }
  | {
      readonly state: 'ok';
      readonly checkedAt: string;
      readonly snapshotTakenAt: string;
    }
  | {
      readonly state: 'failed';
      readonly cause: SyncFailureCause;
      readonly message: string;
      readonly failedAt: string;
      readonly retryAt?: string;
      readonly snapshotTakenAt?: string;
    };
