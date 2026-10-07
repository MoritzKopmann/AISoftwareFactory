import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

// The ticket's GitHub label changes after the run starts or ends, so it can trail the run poll.
export function shouldRereadTicket(
  response: TicketRunResponse | undefined,
  ticketStatus: TicketStatusResponse,
): boolean {
  if (response?.activeRun !== undefined) {
    return (
      ticketStatus !== (response.activeRun.waitingFor === undefined ? 'in-progress' : 'waiting')
    );
  }
  if (response?.lastRun?.ending.kind === 'permission-needed') {
    return ticketStatus !== 'waiting' && ticketStatus !== 'closed';
  }
  return ticketStatus === 'in-progress' && response?.lastRun !== undefined;
}
