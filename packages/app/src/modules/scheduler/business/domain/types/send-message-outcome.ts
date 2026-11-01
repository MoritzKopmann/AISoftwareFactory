import type { StartedRun } from './started-run.js';

export type SendMessageOutcome =
  | { readonly kind: 'pushed' }
  | { readonly kind: 'resumed'; readonly run: StartedRun }
  | { readonly kind: 'held'; readonly pausedUntil: string };
