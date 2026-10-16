import type { ActiveRun } from '../domain/types/active-run.js';
import type { ActiveWait } from '../domain/types/active-wait.js';
import type { Run } from '../domain/types/run.js';
import type { SessionEntry } from '../domain/types/session-entry.js';
import type { TicketSessionWatchEvent } from '../domain/types/ticket-session-watch.js';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { SessionFeed, SessionFeedEvent } from '../port/session/session-feed.js';
import type { RunTranscripts } from '../port/transcript/run-transcripts.js';

export type RunQueryServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly runTranscripts: RunTranscripts;
  readonly sessionFeed: SessionFeed;
};

/** Reads runs, their waits and their session. */
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
    return runs.map((run) => ({ run }));
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

  /**
   * Streams the latest run's session of a ticket to `onEvent`: a snapshot of whole blocks, then
   * live events while the run's feed is active. Returns the unsubscribe function.
   */
  async watchTicketSession(
    projectId: string,
    ticketNumber: number,
    onEvent: (event: TicketSessionWatchEvent) => void,
  ): Promise<() => void> {
    const { runRepository, runTranscripts, sessionFeed } = this.dependencies;

    const run = await runRepository.findLatest(projectId, ticketNumber);
    if (run === undefined) {
      onEvent({ kind: 'no-session' });
      return () => undefined;
    }

    const active = sessionFeed.isActive(run.id);
    const buffered: SessionFeedEvent[] = [];
    let forward: (event: SessionFeedEvent) => void = (event) => buffered.push(event);
    const unsubscribe = active
      ? sessionFeed.subscribe(run.id, (event) => forward(event))
      : () => undefined;

    let transcriptEntries: ReadonlyArray<SessionEntry> = [];
    try {
      transcriptEntries = await runTranscripts.readEntries(run.sessionId, run.worktreePath);
    } catch (error) {
      if (!(error instanceof TranscriptNotFoundError)) {
        unsubscribe();
        throw error;
      }
      if (!active) {
        onEvent({ kind: 'transcript-not-found' });
        return () => undefined;
      }
    }

    const knownIds = new Set(transcriptEntries.map(({ id }) => id));
    const feedEntries = active
      ? sessionFeed.entries(run.id).filter(({ id }) => !knownIds.has(id))
      : [];
    const entries = [...transcriptEntries, ...feedEntries];
    const snapshotIds = new Set(entries.map(({ id }) => id));
    onEvent({ kind: 'snapshot', entries });

    if (!active) {
      onEvent({ kind: 'ended' });
      return () => undefined;
    }

    const deliver = (event: SessionFeedEvent): void => {
      if (event.kind === 'entry') {
        if (!snapshotIds.has(event.entry.id)) {
          snapshotIds.add(event.entry.id);
          onEvent(event);
        }
      } else if (event.kind === 'text-delta') {
        onEvent({ kind: 'delta', opensBlock: event.opensBlock, text: event.text });
      } else {
        onEvent({ kind: 'ended' });
      }
    };
    forward = deliver;
    for (const event of buffered) {
      deliver(event);
    }
    return unsubscribe;
  }
}
