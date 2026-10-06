export type RunAnswerWaitOutcome =
  | { readonly kind: 'answered'; readonly text: string }
  | { readonly kind: 'expired' }
  | { readonly kind: 'cancelled' };

export interface RunAnswerWaits {
  wait(runId: string, windowMilliseconds: number): Promise<RunAnswerWaitOutcome>;
  deliver(runId: string, text: string): boolean;
  cancel(runId: string): void;
}
