import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type LabelMarker = 'stuck' | 'waiting';

export function describeLabelMarker(ticket: TicketResponse): LabelMarker | undefined {
  if (ticket.stuck) {
    return 'stuck';
  }
  if (ticket.waiting) {
    return 'waiting';
  }
  return undefined;
}
