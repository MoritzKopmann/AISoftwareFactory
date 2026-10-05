import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { isResettable } from './is-resettable.js';
import type { ResetTicketOutcome } from './reset-ticket.js';

export type ResetState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'resetting' }
  | Extract<ResetTicketOutcome, { kind: 'failed' }>;

type ResetActionError = { readonly message: string; readonly detail?: string };

export type ResetActionDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly resetting: boolean;
      readonly announcement?: string;
      readonly error?: ResetActionError;
    };

// A reset that succeeded stays `resetting` until the page shows the new status, which hides Reset.
export function settleResetState(
  reset: ResetState,
  response: TicketRunResponse | undefined,
  ticketStatus: TicketStatusResponse,
): ResetState {
  return reset.kind === 'idle' || isResettable(response, ticketStatus) ? reset : { kind: 'idle' };
}

export function describeResetAction(
  response: TicketRunResponse | undefined,
  ticketStatus: TicketStatusResponse,
  reset: ResetState,
  number: number,
): ResetActionDescription {
  if (!isResettable(response, ticketStatus)) {
    return { kind: 'hidden' };
  }
  if (reset.kind === 'resetting') {
    return { kind: 'shown', resetting: true, announcement: `Resetting #${number}` };
  }
  if (reset.kind === 'failed') {
    return {
      kind: 'shown',
      resetting: false,
      error: {
        message: `Couldn't reset #${number}. ${reset.message}`.trimEnd(),
        ...(reset.status === undefined ? {} : { detail: String(reset.status) }),
      },
    };
  }
  return { kind: 'shown', resetting: false };
}
