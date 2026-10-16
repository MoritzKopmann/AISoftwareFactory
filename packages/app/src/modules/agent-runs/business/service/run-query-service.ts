import type { ActiveRun } from '../domain/types/active-run.js';
import type { ActiveWait } from '../domain/types/active-wait.js';
import type { RunLog } from '../domain/types/run-log.js';
import type { Run } from '../domain/types/run.js';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import type { RecentRunSteps } from '../port/repository/recent-run-steps.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { RunTranscripts } from '../port/transcript/run-transcripts.js';

const maximumEntryCount = 200;

export type RunQueryServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly recentRunSteps: RecentRunSteps;
  readonly runTranscripts: RunTranscripts;
};

/** Reads runs, their live steps, their waits and their transcript log. */
export class RunQueryService {
  constructor(private readonly dependencies: RunQueryServiceDependencies) {}

  read(runId: string): Promise<Run | undefined> {
    return this.dependencies.runRepository.findById(runId);
  }

  readLatest(projectId: string, ticketNumber: number): Promise<Run | undefined> {
    return this.dependencies.runRepository.findLatest(projectId, ticketNumber);
  }

  async readActive(projectId: string): Promise<ReadonlyArray<ActiveRun>> {
    const runs = await this.dependencies.runRepository.listActive(projectId);
    return runs.map((run) => ({ run, steps: this.dependencies.recentRunSteps.read(run.id) }));
  }

  async readActiveWaits(projectId: string): Promise<ReadonlyArray<ActiveWait>> {
    const runs = await this.dependencies.runRepository.listActive(projectId);
    return runs.flatMap((run) => {
      const { waitingFor, waitingSince } = run;
      if (waitingFor === undefined || waitingSince === undefined) {
        return [];
      }
      const kind =
        waitingFor.kind === 'permission-needed'
          ? 'permission'
          : waitingFor.artifactId === undefined
            ? 'question'
            : 'round';
      return [{ ticketNumber: run.ticketNumber, kind, since: waitingSince }];
    });
  }

  async readTicketLog(projectId: string, ticketNumber: number): Promise<RunLog> {
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
