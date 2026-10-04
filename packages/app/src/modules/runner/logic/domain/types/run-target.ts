import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type RunTarget = {
  readonly checkoutPath: string;
  readonly repositoryName: string;
  readonly ticketTitle: string;
  readonly types: ReadonlyArray<TicketType>;
};
