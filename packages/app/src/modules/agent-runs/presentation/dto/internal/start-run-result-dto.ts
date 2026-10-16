import type { RunDto } from './run-dto.js';

/** `already-active`: the ticket already has a running run. Nothing was started. */
export type StartRunResultDto =
  | { readonly kind: 'started'; readonly run: RunDto }
  | { readonly kind: 'already-active'; readonly message: string };
