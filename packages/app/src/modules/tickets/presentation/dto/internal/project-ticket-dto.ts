import type { SyncStatusDto } from './sync-status-dto.js';
import type { TicketDto } from './ticket-dto.js';

export type ProjectTicketDto = {
  readonly projectId: string;
  readonly sync: SyncStatusDto;
  readonly ticket?: TicketDto | undefined;
};
