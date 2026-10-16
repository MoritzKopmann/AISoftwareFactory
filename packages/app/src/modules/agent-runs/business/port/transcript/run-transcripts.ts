import type { RunLogEntry } from '../../domain/types/run-log-entry.js';
import type { SessionEntry } from '../../domain/types/session-entry.js';

export interface RunTranscripts {
  read(sessionId: string, worktreePath: string): Promise<ReadonlyArray<RunLogEntry>>;
  readEntries(sessionId: string, worktreePath: string): Promise<ReadonlyArray<SessionEntry>>;
}
