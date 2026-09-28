import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export function ticketStatusLabel(status: TicketStatusResponse): string {
  const spacedName = status.replace('-', ' ');
  return spacedName.charAt(0).toUpperCase() + spacedName.slice(1);
}
