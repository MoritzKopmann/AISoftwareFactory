import type { Run } from '../domain/types/run.js';
import type { RunEnding } from '../domain/types/run-ending.js';
import type { RunWait } from '../domain/types/run-wait.js';

export interface RunRepository {
  insert(run: Run): Promise<void>;
  findById(runId: string): Promise<Run | undefined>;
  listActive(projectId: string): Promise<ReadonlyArray<Run>>;
  findLatest(projectId: string, ticketNumber: number): Promise<Run | undefined>;
  listByState(state: Run['state']): Promise<ReadonlyArray<Run>>;
  recordEnding(
    runId: string,
    ending: RunEnding,
    endedAt: string,
  ): Promise<'recorded' | 'already-ended'>;
  recordWait(runId: string, wait: RunWait, waitingSince: string): Promise<'recorded' | 'refused'>;
  clearWait(runId: string): Promise<void>;
  markSettled(runId: string, settledAt: string): Promise<void>;
}
