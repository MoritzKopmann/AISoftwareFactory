import type { BoardView } from './board-view.js';
import type { SyncStatus } from './sync-status.js';

export type ProjectBoard = {
  readonly projectId: string;
  readonly sync: SyncStatus;
  readonly board?: BoardView;
};
