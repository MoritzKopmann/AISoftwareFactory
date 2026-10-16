import type { RunDto } from './run-dto.js';

/**
 * `already-active`: the ticket already has a running run.
 * `not-resumable`: the run has no ending the answer fits. Nothing was resumed.
 */
export type AnswerRunResultDto =
  | { readonly kind: 'answered'; readonly run: RunDto }
  | { readonly kind: 'already-active'; readonly message: string }
  | { readonly kind: 'not-resumable'; readonly message: string };
