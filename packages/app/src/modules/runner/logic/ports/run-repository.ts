import type { Run } from '../domain/types/run.js';
import type { RunEnding } from '../domain/types/run-ending.js';

export interface RunRepository {
  insert(run: Run): Promise<void>;
  findById(runId: string): Promise<Run | undefined>;
  findActive(projectId: string): Promise<Run | undefined>;
  findLatest(projectId: string, ticketNumber: number): Promise<Run | undefined>;
  listByState(state: Run['state']): Promise<ReadonlyArray<Run>>;
  recordEnding(
    runId: string,
    ending: RunEnding,
    endedAt: string,
  ): Promise<'recorded' | 'already-ended'>;
  markSettled(runId: string, settledAt: string): Promise<void>;
}
