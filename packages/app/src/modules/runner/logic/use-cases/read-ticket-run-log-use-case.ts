import type { RunLog } from '../domain/types/run-log.js';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import type { RunRepository } from '../ports/run-repository.js';
import type { RunTranscripts } from '../ports/run-transcripts.js';

const maximumEntryCount = 200;

export type ReadTicketRunLogDependencies = {
  readonly runRepository: RunRepository;
  readonly runTranscripts: RunTranscripts;
};

export class ReadTicketRunLogUseCase {
  constructor(private readonly dependencies: ReadTicketRunLogDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<RunLog> {
    const { runRepository, runTranscripts } = this.dependencies;

    const run = await runRepository.findLatest(projectId, ticketNumber);
    if (run === undefined) {
      return { kind: 'no-session' };
    }

    try {
      const entries = await runTranscripts.read(run.sessionId, run.worktreePath);
      return { kind: 'found', entries: entries.slice(-maximumEntryCount), total: entries.length };
    } catch (error) {
      if (error instanceof TranscriptNotFoundError) {
        return { kind: 'transcript-not-found' };
      }
      throw error;
    }
  }
}
