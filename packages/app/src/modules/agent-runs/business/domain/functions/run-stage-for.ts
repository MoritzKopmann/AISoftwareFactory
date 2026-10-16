import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';
import type { RunStage } from '../types/run-stage.js';

export function runStageFor(ticket: {
  readonly status: TicketStatus;
  readonly types: ReadonlyArray<TicketType>;
}): RunStage {
  if (ticket.status === 'idea') {
    return 'create';
  }
  if (ticket.status === 'plan') {
    return 'plan';
  }
  return ticket.types.includes('spike') ? 'spike' : 'implement';
}
