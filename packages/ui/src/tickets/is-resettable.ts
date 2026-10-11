import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type ResettableTicketState = Pick<TicketResponse, 'status' | 'stuck'>;

// An in-progress ticket whose run ended at a checkpoint is GitHub catching up to `waiting`.
export function isResettable(
  response: TicketRunResponse | undefined,
  ticketState: ResettableTicketState,
): boolean {
  if (response === undefined || response.activeRun !== undefined) {
    return false;
  }
  if (ticketState.stuck) {
    return true;
  }
  return ticketState.status === 'in-progress' && response.lastRun?.ending.kind !== 'checkpoint';
}
