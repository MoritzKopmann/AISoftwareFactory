import type { RunStep } from '../domain/types/run-step.js';

export interface SessionTranscripts {
  read(sessionId: string, worktreePath: string): Promise<ReadonlyArray<RunStep>>;
}
