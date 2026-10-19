import type { StartedRun } from './started-run.js';

export type RunAnswerOutcome =
  | { readonly kind: 'answered'; readonly run: StartedRun }
  | { readonly kind: 'held'; readonly pausedUntil: string };
