import type { StartedRunDto } from './started-run-dto.js';

export type RunAnswerResultDto =
  | { readonly kind: 'answered'; readonly run: StartedRunDto }
  | { readonly kind: 'held'; readonly pausedUntil: string };
