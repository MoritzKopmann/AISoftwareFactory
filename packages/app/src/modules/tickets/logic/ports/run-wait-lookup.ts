import type { NeedsYouWait } from '../domain/types/needs-you-row.js';

export type RunWait = NeedsYouWait;

export interface RunWaitLookup {
  waitsOf(projectId: string): Promise<ReadonlyArray<RunWait>>;
}
