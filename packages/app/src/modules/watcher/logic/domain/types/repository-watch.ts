import type { RepositoryReference } from './repository-reference.js';
import type { SyncStatus } from './sync-status.js';
import type { TicketSnapshot } from './ticket-snapshot.js';

export type RepositoryWatch = {
  readonly projectId: string;
  readonly repository: RepositoryReference;
  readonly snapshot?: TicketSnapshot;
  readonly sync: SyncStatus;
};
