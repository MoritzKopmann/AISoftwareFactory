import type { SessionLogEntry } from '../domain/types/session-log-entry.js';

export interface SessionTranscripts {
  read(sessionId: string, worktreePath: string): Promise<ReadonlyArray<SessionLogEntry>>;
}
