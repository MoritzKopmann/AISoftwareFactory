import type { NeedsYouWait } from '../../domain/types/needs-you-row.js';

export type RunWait = NeedsYouWait;

export interface RunPort {
  activeRunTicketNumbers(projectId: string): Promise<ReadonlyArray<number>>;
  settle(runId: string): Promise<void>;
  waitsOf(projectId: string): Promise<ReadonlyArray<RunWait>>;
}
