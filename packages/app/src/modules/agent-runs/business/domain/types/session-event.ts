import type { RunStep } from './run-step.js';
import type { SessionEntry } from './session-entry.js';

export type SessionEvent =
  | { readonly kind: 'step'; readonly step: RunStep }
  | { readonly kind: 'entry'; readonly entry: SessionEntry }
  | { readonly kind: 'text-delta'; readonly opensBlock: boolean; readonly text: string }
  | { readonly kind: 'usage-limit'; readonly reason: string }
  | { readonly kind: 'crashed'; readonly reason: string }
  | { readonly kind: 'completed' };
