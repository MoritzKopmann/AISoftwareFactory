import type { RunAnswer } from '../domain/types/run-answer.js';

export type RunAnswerWaitOutcome =
  | { readonly kind: 'answered'; readonly answer: RunAnswer }
  | { readonly kind: 'expired' }
  | { readonly kind: 'cancelled' };

export interface RunAnswerWaits {
  wait(runId: string, windowMilliseconds: number): Promise<RunAnswerWaitOutcome>;
  deliver(runId: string, answer: RunAnswer): boolean;
  cancel(runId: string): void;
}
