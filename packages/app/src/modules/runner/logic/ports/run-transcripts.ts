import type { RunLogEntry } from '../domain/types/run-log-entry.js';

export interface RunTranscripts {
  read(sessionId: string, worktreePath: string): Promise<ReadonlyArray<RunLogEntry>>;
}
