import type { TicketStatus } from './ticket-status.js';

export const ticketStatusOrder: ReadonlyArray<TicketStatus> = [
  'idea',
  'backlog',
  'plan',
  'planned',
  'ready',
  'in-progress',
  'in-review',
  'stuck',
  'conflict',
  'closed',
];
