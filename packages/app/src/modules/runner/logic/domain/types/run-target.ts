import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type RunTarget = {
  readonly checkoutPath: string;
  readonly repositoryName: string;
  readonly ticketTitle: string;
  readonly status: TicketStatus;
  readonly types: ReadonlyArray<TicketType>;
};
