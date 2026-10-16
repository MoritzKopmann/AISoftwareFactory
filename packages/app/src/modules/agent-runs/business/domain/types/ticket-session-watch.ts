import type { SessionEntry } from './session-entry.js';

/** One step of a ticket session watch. `no-session`, `transcript-not-found` and `ended` are last. */
export type TicketSessionWatchEvent =
  | { readonly kind: 'snapshot'; readonly entries: ReadonlyArray<SessionEntry> }
  | { readonly kind: 'no-session' }
  | { readonly kind: 'transcript-not-found' }
  | { readonly kind: 'entry'; readonly entry: SessionEntry }
  | { readonly kind: 'delta'; readonly opensBlock: boolean; readonly text: string }
  | { readonly kind: 'ended' };
