import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

export const ticketStatusOrder: ReadonlyArray<TicketStatus> = [
  'idea',
  'backlog',
  'plan',
  'planned',
  'ready',
  'in-progress',
  'in-review',
  'conflict',
  'closed',
];
