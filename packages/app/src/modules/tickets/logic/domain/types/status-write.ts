import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

export type StatusWrite = {
  readonly ticketNumber: number;
  readonly from: TicketStatus;
  readonly to: TicketStatus;
  readonly waiting: boolean;
  readonly stuck: boolean;
  readonly writtenAt: string;
};
