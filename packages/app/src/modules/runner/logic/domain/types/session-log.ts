import type { SessionLogEntry } from './session-log-entry.js';

export type SessionLog =
  | {
      readonly kind: 'found';
      readonly entries: ReadonlyArray<SessionLogEntry>;
      readonly total: number;
    }
  | { readonly kind: 'no-session' }
  | { readonly kind: 'transcript-not-found' };
