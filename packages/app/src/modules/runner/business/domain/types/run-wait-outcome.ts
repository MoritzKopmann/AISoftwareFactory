import type { RunAnswer } from './run-answer.js';

export type RunWaitOutcome =
  | { readonly kind: 'answered'; readonly answer: RunAnswer }
  | { readonly kind: 'unanswered'; readonly message: string };
