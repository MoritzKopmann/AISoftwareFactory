import { commandToLabel } from '../domain/functions/command-to-label.js';
import type { ActiveRun } from '../domain/types/active-run.js';
import type { ActiveWait } from '../domain/types/active-wait.js';
import type { Run } from '../domain/types/run.js';
import type { SessionEntry } from '../domain/types/session-entry.js';
import type { TicketSessionWatchEvent } from '../domain/types/ticket-session-watch.js';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { SessionFeed, SessionFeedEvent } from '../port/session/session-feed.js';
import type { RunTranscripts } from '../port/transcript/run-transcripts.js';
import type { CommandLabelService } from './command-label-service.js';

export type RunQueryServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly runTranscripts: RunTranscripts;
  readonly sessionFeed: SessionFeed;
  readonly commandLabelService: Pick<CommandLabelService, 'labelFor' | 'storedLabelFor'>;
};

type LabellableCall = {
  readonly toolUseId: string;
  readonly command: string;
};

function labellableCallOf(entry: SessionEntry): LabellableCall | undefined {
  const command = commandToLabel(entry);
  if (command === undefined || entry.kind !== 'tool-call') {
    return undefined;
  }
  return { toolUseId: entry.toolUseId, command };
}

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
    const { runRepository, runTranscripts, sessionFeed, commandLabelService } = this.dependencies;

    const run = await runRepository.findLatest(projectId, ticketNumber);
    if (run === undefined) {
      onEvent({ kind: 'no-session' });
      return () => undefined;
    }

    let closed = false;
    const emit = (event: TicketSessionWatchEvent): void => {
      if (!closed) {
        onEvent(event);
      }
    };
    const pendingLabels = new Set<Promise<void>>();
    const startLabel = (entry: SessionEntry): void => {
      const call = labellableCallOf(entry);
      if (call === undefined) {
        return;
      }
      const pending = commandLabelService
        .labelFor(call.command)
        .then((label) => {
          if (label !== undefined) {
            emit({ kind: 'label', toolUseId: call.toolUseId, label });
          }
        })
        // Never-crash boundary: a failed label leaves the call unlabelled and must not reject unhandled.
        .catch(() => undefined)
        .finally(() => pendingLabels.delete(pending));
      pendingLabels.add(pending);
    };
    const end = async (): Promise<void> => {
      if (pendingLabels.size > 0) {
        await Promise.all([...pendingLabels]);
      }
      emit({ kind: 'ended' });
    };

    const active = sessionFeed.isActive(run.id);
    const buffered: SessionFeedEvent[] = [];
    let forward: (event: SessionFeedEvent) => void = (event) => buffered.push(event);
    const unsubscribeFeed = active
      ? sessionFeed.subscribe(run.id, (event) => forward(event))
      : () => undefined;
    const unsubscribe = (): void => {
      closed = true;
      unsubscribeFeed();
    };

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
    const snapshotEntries = [...transcriptEntries, ...feedEntries];
    const snapshotIds = new Set(snapshotEntries.map(({ id }) => id));
    const unlabelled: SessionEntry[] = [];
    const entries = await Promise.all(
      snapshotEntries.map(async (entry) => {
        const call = labellableCallOf(entry);
        if (call === undefined) {
          return entry;
        }
        const label = await commandLabelService.storedLabelFor(call.command);
        if (label === undefined) {
          unlabelled.push(entry);
          return entry;
        }
        return { ...entry, label };
      }),
    );
    emit({ kind: 'snapshot', entries, root: run.worktreePath });
    unlabelled.forEach(startLabel);

    if (!active) {
      await end();
      return unsubscribe;
    }

    const deliver = (event: SessionFeedEvent): void => {
      if (event.kind === 'entry') {
        if (!snapshotIds.has(event.entry.id)) {
          snapshotIds.add(event.entry.id);
          emit(event);
          startLabel(event.entry);
        }
      } else if (event.kind === 'text-delta') {
        emit({ kind: 'delta', opensBlock: event.opensBlock, text: event.text });
      } else {
        void end();
      }
    };
    forward = deliver;
    for (const event of buffered) {
      deliver(event);
    }
    return unsubscribe;
  }
}
