import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type TicketLiveState = {
  readonly status: TicketStatus;
  readonly waiting: boolean;
  readonly stuck: boolean;
  readonly types: ReadonlyArray<TicketType>;
};
