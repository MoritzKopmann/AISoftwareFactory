import type { RunStep } from './run-step.js';

export type SessionEvent =
  | { readonly kind: 'step'; readonly step: RunStep }
  | { readonly kind: 'usage-limit'; readonly reason: string }
  | { readonly kind: 'crashed'; readonly reason: string }
  | { readonly kind: 'completed' };
