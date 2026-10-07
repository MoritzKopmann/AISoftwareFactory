import type { RunLogEntry } from './run-log-entry.js';

export type RunLog =
  | {
      readonly kind: 'found';
      readonly entries: ReadonlyArray<RunLogEntry>;
      readonly total: number;
    }
  | { readonly kind: 'no-session' }
  | { readonly kind: 'transcript-not-found' };
