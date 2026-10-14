export type SyncStatusDto =
  | { readonly state: 'pending' }
  | {
      readonly state: 'ok';
      readonly checkedAt: string;
      readonly snapshotTakenAt: string;
    }
  | {
      readonly state: 'failed';
      readonly cause: 'auth' | 'rate-limited' | 'unavailable' | 'unexpected';
      readonly message: string;
      readonly failedAt: string;
      readonly retryAt?: string | undefined;
      readonly snapshotTakenAt?: string | undefined;
    };
