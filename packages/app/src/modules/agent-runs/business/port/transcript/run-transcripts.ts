import type { SessionEntry } from '../../domain/types/session-entry.js';

export interface RunTranscripts {
  readEntries(sessionId: string, worktreePath: string): Promise<ReadonlyArray<SessionEntry>>;
}
