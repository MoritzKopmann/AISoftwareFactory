import type { SyncStatus } from './sync-status.js';
import type { Ticket } from './ticket.js';

export type ProjectTicket = {
  readonly projectId: string;
  readonly sync: SyncStatus;
  readonly ticket?: Ticket;
};
