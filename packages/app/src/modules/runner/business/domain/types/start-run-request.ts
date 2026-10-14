import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';
import type { RunMode } from './run-mode.js';

export type StartRunRequest = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly mode: RunMode;
  readonly ticketTitle: string;
  readonly status: TicketStatus;
  readonly types: ReadonlyArray<TicketType>;
};
