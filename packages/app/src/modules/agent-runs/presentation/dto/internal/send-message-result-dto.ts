import type { RunDto } from './run-dto.js';

/**
 * `pushed`: the live session took the message.
 * `resumed`: the ended run was resumed with it.
 * `already-active`: the ticket already has a running run.
 * `not-resumable`: the run cannot take a message. Nothing was sent.
 */
export type SendMessageResultDto =
  | { readonly kind: 'pushed' }
  | { readonly kind: 'resumed'; readonly run: RunDto }
  | { readonly kind: 'already-active'; readonly message: string }
  | { readonly kind: 'not-resumable'; readonly message: string };
