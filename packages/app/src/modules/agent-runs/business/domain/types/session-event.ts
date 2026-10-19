import type { SessionEntry } from './session-entry.js';

export type ObservedWindow = {
  readonly utilizationPercent: number;
  readonly resetsAt: string;
};

/** Calls were refused. `resetsAt` is null when the session names no reset time. */
export type WindowRefusal = { readonly window: string; readonly resetsAt: string | null };

export type SessionEvent =
  | { readonly kind: 'entry'; readonly entry: SessionEntry }
  | { readonly kind: 'text-delta'; readonly opensBlock: boolean; readonly text: string }
  | {
      readonly kind: 'window-observed';
      readonly fiveHour: ObservedWindow | null;
      readonly sevenDay: ObservedWindow | null;
      readonly refusal: WindowRefusal | null;
    }
  | { readonly kind: 'crashed'; readonly reason: string }
  | { readonly kind: 'completed' };
