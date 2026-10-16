import type { SessionEntry } from '../../domain/types/session-entry.js';

export type SessionFeedEvent =
  | { readonly kind: 'entry'; readonly entry: SessionEntry }
  | { readonly kind: 'text-delta'; readonly opensBlock: boolean; readonly text: string }
  | { readonly kind: 'ended' };

/** Live session data of runs, in memory. Keyed by run id. */
export interface SessionFeed {
  publish(runId: string, event: SessionFeedEvent): void;
  /** Entries published for the run, in order. Empty when none or ended. */
  entries(runId: string): ReadonlyArray<SessionEntry>;
  /** Returns the unsubscribe function. */
  subscribe(runId: string, listener: (event: SessionFeedEvent) => void): () => void;
  /** True from the first publish until `end`. */
  isActive(runId: string): boolean;
  /** Listeners receive `ended`, then the run's entries and listeners are dropped. */
  end(runId: string): void;
}
