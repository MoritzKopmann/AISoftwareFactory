import type { SessionLog } from '../domain/types/session-log.js';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import type { RunRepository } from '../ports/run-repository.js';
import type { SessionTranscripts } from '../ports/session-transcripts.js';

const maximumEntryCount = 200;

export type ReadSessionLogDependencies = {
  readonly runRepository: RunRepository;
  readonly sessionTranscripts: SessionTranscripts;
};

export class ReadSessionLogUseCase {
  constructor(private readonly dependencies: ReadSessionLogDependencies) {}

  async execute(runId: string): Promise<SessionLog> {
    const { runRepository, sessionTranscripts } = this.dependencies;

    const run = await runRepository.findById(runId);
    if (run === undefined) {
      return { kind: 'no-session' };
    }

    try {
      const entries = await sessionTranscripts.read(run.sessionId, run.worktreePath);
      return { kind: 'found', entries: entries.slice(-maximumEntryCount), total: entries.length };
    } catch (error) {
      if (error instanceof TranscriptNotFoundError) {
        return { kind: 'transcript-not-found' };
      }
      throw error;
    }
  }
}
