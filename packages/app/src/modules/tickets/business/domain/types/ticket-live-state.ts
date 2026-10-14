import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

export type TicketLiveState = {
  readonly status: TicketStatus;
  readonly waiting: boolean;
  readonly stuck: boolean;
};
