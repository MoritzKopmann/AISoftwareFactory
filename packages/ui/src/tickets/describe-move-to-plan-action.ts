import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { MoveTicketToPlanOutcome } from './move-ticket-to-plan.js';

export type MoveToPlanState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'done' }
  | Extract<MoveTicketToPlanOutcome, { kind: 'failed' }>;

export type MoveToPlanActionDescription =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly message: string };

// A move that succeeded stays `done` until the page shows the new status, which hides the action.
export function describeMoveToPlanAction(
  status: TicketStatusResponse,
  state: MoveToPlanState,
  number: number,
): MoveToPlanActionDescription {
  if (status !== 'backlog') {
    return { kind: 'hidden' };
  }
  if (state.kind === 'failed') {
    return {
      kind: 'failed',
      message: state.message === '' ? `Couldn't move #${number} to plan.` : state.message,
    };
  }
  return { kind: state.kind };
}
