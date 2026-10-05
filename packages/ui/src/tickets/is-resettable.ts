import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

// An in-progress ticket whose run ended at a checkpoint is GitHub catching up to `waiting`.
export function isResettable(
  response: TicketRunResponse | undefined,
  ticketStatus: TicketStatusResponse,
): boolean {
  if (response === undefined || response.activeRun !== undefined) {
    return false;
  }
  if (ticketStatus === 'stuck') {
    return true;
  }
  return ticketStatus === 'in-progress' && response.lastRun?.ending.kind !== 'checkpoint';
}
