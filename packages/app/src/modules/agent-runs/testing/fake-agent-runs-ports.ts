import { RunAlreadyActiveError } from '../business/errors/run-already-active-error.js';
import type { Run } from '../business/domain/types/run.js';
import type { RunEnding } from '../business/domain/types/run-ending.js';
import type { RunWait } from '../business/domain/types/run-wait.js';
import type { SessionEntry } from '../business/domain/types/session-entry.js';
import type { SessionFeed, SessionFeedEvent } from '../business/port/session/session-feed.js';
import type { RunTarget } from '../business/domain/types/run-target.js';
import type { SessionEvent } from '../business/domain/types/session-event.js';
import type { ResumeSessionSpec } from '../business/domain/types/resume-session-spec.js';
import type { SessionSpec } from '../business/domain/types/session-spec.js';
import type { DetachedWorktreeSpec } from '../business/domain/types/detached-worktree-spec.js';
import type { RemovableWorktreeSpec } from '../business/domain/types/removable-worktree-spec.js';
import type { WorktreeSpec } from '../business/domain/types/worktree-spec.js';
import type { AgentSessions } from '../business/port/session/agent-sessions.js';
import type { Identifiers } from '../../../shared/identifiers/identifiers.js';
import type { RunAnswer } from '../business/domain/types/run-answer.js';
import type {
  RunAnswerWaitOutcome,
  RunAnswerWaits,
} from '../business/port/repository/run-answer-waits.js';
import type { RunRepository } from '../business/port/repository/run-repository.js';
import type { ProjectPort } from '../business/port/project/project-port.js';
import type { RunTranscripts } from '../business/port/transcript/run-transcripts.js';
import type { CommandLabeler } from '../business/port/label/command-labeler.js';
import type { CommandLabelRepository } from '../business/port/repository/command-label-repository.js';
import type { Worktrees } from '../business/port/worktree/worktrees.js';

function withoutWait(run: Run): Run {
  const copy: { -readonly [Key in keyof Run]: Run[Key] } = { ...run };
  delete copy.waitingFor;
  delete copy.waitingSince;
  return copy;
}

export class FakeRunRepository implements RunRepository {
  readonly runs = new Map<string, Run>();

  async insert(run: Run): Promise<void> {
    const runningRun = [...this.runs.values()].find(
      (existing) =>
        existing.projectId === run.projectId &&
        existing.ticketNumber === run.ticketNumber &&
        existing.state === 'running',
    );
    if (runningRun !== undefined && run.state === 'running') {
      throw new RunAlreadyActiveError(
        `${run.projectId} already has a running run for #${run.ticketNumber}`,
      );
    }
    this.runs.set(run.id, run);
  }

  async findById(runId: string): Promise<Run | undefined> {
    return this.runs.get(runId);
  }

  async listActive(projectId: string): Promise<ReadonlyArray<Run>> {
    return [...this.runs.values()].filter(
      (run) => run.projectId === projectId && run.state === 'running',
    );
  }

  async findLatest(projectId: string, ticketNumber: number): Promise<Run | undefined> {
    return [...this.runs.values()]
      .filter((run) => run.projectId === projectId && run.ticketNumber === ticketNumber)
      .sort((first, second) => second.startedAt.localeCompare(first.startedAt))[0];
  }

  async listByState(state: Run['state']): Promise<ReadonlyArray<Run>> {
    return [...this.runs.values()].filter((run) => run.state === state);
  }

  async recordEnding(
    runId: string,
    ending: RunEnding,
    endedAt: string,
  ): Promise<'recorded' | 'already-ended'> {
    const run = this.runs.get(runId);
    if (run === undefined || run.state !== 'running') {
      return 'already-ended';
    }
    this.runs.set(runId, { ...withoutWait(run), state: 'ended', ending, endedAt });
    return 'recorded';
  }

  async recordWait(
    runId: string,
    wait: RunWait,
    waitingSince: string,
  ): Promise<'recorded' | 'refused'> {
    const run = this.runs.get(runId);
    if (run === undefined || run.state !== 'running' || run.waitingFor !== undefined) {
      return 'refused';
    }
    this.runs.set(runId, { ...run, waitingFor: wait, waitingSince });
    return 'recorded';
  }

  async clearWait(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run !== undefined) {
      this.runs.set(runId, withoutWait(run));
    }
  }

  async recordHeldAnswer(runId: string, answer: RunAnswer): Promise<void> {
    const run = this.runs.get(runId);
    if (run !== undefined) {
      this.runs.set(runId, { ...run, heldAnswer: answer });
    }
  }

  async clearHeldAnswer(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run !== undefined) {
      const copy: { -readonly [Key in keyof Run]: Run[Key] } = { ...run };
      delete copy.heldAnswer;
      this.runs.set(runId, copy);
    }
  }

  async listPaused(projectId: string): Promise<ReadonlyArray<Run>> {
    const latestByTicket = new Map<number, Run>();
    for (const run of this.runs.values()) {
      const latest = latestByTicket.get(run.ticketNumber);
      if (
        run.projectId === projectId &&
        (latest === undefined || run.startedAt > latest.startedAt)
      ) {
        latestByTicket.set(run.ticketNumber, run);
      }
    }
    return [...latestByTicket.values()].filter(
      (run) => run.ending?.kind === 'usage-limit' || run.heldAnswer !== undefined,
    );
  }

  async markSettled(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run !== undefined) {
      this.runs.set(runId, { ...run, state: 'settled' });
    }
  }
}

export class FakeRunAnswerWaits implements RunAnswerWaits {
  readonly windowsByRunId = new Map<string, number>();
  readonly cancelledRunIds: string[] = [];
  private readonly settlersByRunId = new Map<string, (outcome: RunAnswerWaitOutcome) => void>();

  wait(runId: string, windowMilliseconds: number): Promise<RunAnswerWaitOutcome> {
    this.windowsByRunId.set(runId, windowMilliseconds);
    return new Promise((resolve) => {
      this.settlersByRunId.set(runId, resolve);
    });
  }

  deliver(runId: string, answer: RunAnswer): boolean {
    return this.settle(runId, { kind: 'answered', answer });
  }

  cancel(runId: string): void {
    this.cancelledRunIds.push(runId);
    this.settle(runId, { kind: 'cancelled' });
  }

  expire(runId: string): void {
    this.settle(runId, { kind: 'expired' });
  }

  isWaiting(runId: string): boolean {
    return this.settlersByRunId.has(runId);
  }

  private settle(runId: string, outcome: RunAnswerWaitOutcome): boolean {
    const settler = this.settlersByRunId.get(runId);
    if (settler === undefined) {
      return false;
    }
    this.settlersByRunId.delete(runId);
    settler(outcome);
    return true;
  }
}

export class FakeAgentSessions implements AgentSessions {
  readonly startedSpecs: SessionSpec[] = [];
  readonly resumedSpecs: ResumeSessionSpec[] = [];
  readonly stoppedSessionIds: string[] = [];
  stopAllCalls = 0;
  private readonly queuesBySessionId = new Map<string, SessionQueue>();

  start(spec: SessionSpec): AsyncIterable<SessionEvent> {
    this.startedSpecs.push(spec);
    return this.openQueue(spec.sessionId);
  }

  resume(spec: ResumeSessionSpec): AsyncIterable<SessionEvent> {
    this.resumedSpecs.push(spec);
    return this.openQueue(spec.sessionId);
  }

  private openQueue(sessionId: string): SessionQueue {
    const queue = new SessionQueue();
    this.queuesBySessionId.set(sessionId, queue);
    return queue;
  }

  stop(sessionId: string): void {
    this.stoppedSessionIds.push(sessionId);
    this.queuesBySessionId.get(sessionId)?.close();
  }

  stopAll(): void {
    this.stopAllCalls += 1;
  }

  push(sessionId: string, event: SessionEvent): void {
    this.queuesBySessionId.get(sessionId)?.push(event);
  }

  /** Ends the stream like a real session does after its last event. */
  close(sessionId: string): void {
    this.queuesBySessionId.get(sessionId)?.close();
  }

  fail(sessionId: string, error: Error): void {
    this.queuesBySessionId.get(sessionId)?.fail(error);
  }
}

class SessionQueue implements AsyncIterable<SessionEvent> {
  private readonly pending: SessionEvent[] = [];
  private waiting: ((result: IteratorResult<SessionEvent>) => void) | undefined;
  private rejectWaiting: ((error: Error) => void) | undefined;
  private closed = false;
  private failure: Error | undefined;

  push(event: SessionEvent): void {
    if (this.waiting === undefined) {
      this.pending.push(event);
      return;
    }
    const resolve = this.waiting;
    this.waiting = undefined;
    this.rejectWaiting = undefined;
    resolve({ value: event, done: false });
  }

  close(): void {
    this.closed = true;
    const resolve = this.waiting;
    this.waiting = undefined;
    this.rejectWaiting = undefined;
    resolve?.({ value: undefined, done: true });
  }

  fail(error: Error): void {
    this.failure = error;
    const reject = this.rejectWaiting;
    this.waiting = undefined;
    this.rejectWaiting = undefined;
    reject?.(error);
  }

  [Symbol.asyncIterator](): AsyncIterator<SessionEvent> {
    return {
      next: () => {
        const event = this.pending.shift();
        if (event !== undefined) {
          return Promise.resolve({ value: event, done: false });
        }
        if (this.failure !== undefined) {
          return Promise.reject(this.failure);
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve, reject) => {
          this.waiting = resolve;
          this.rejectWaiting = reject;
        });
      },
    };
  }
}

export class FakeWorktrees implements Worktrees {
  readonly ensuredSpecs: WorktreeSpec[] = [];
  readonly detachedSpecs: DetachedWorktreeSpec[] = [];
  readonly removedSpecs: RemovableWorktreeSpec[] = [];
  readonly removalFailuresByPath = new Map<string, Error>();
  failure: Error | undefined;

  async remove(spec: RemovableWorktreeSpec): Promise<void> {
    const removalFailure = this.removalFailuresByPath.get(spec.worktreePath);
    if (removalFailure !== undefined) {
      throw removalFailure;
    }
    this.removedSpecs.push(spec);
  }

  async ensureDetached(spec: DetachedWorktreeSpec): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.detachedSpecs.push(spec);
  }

  async ensure(spec: WorktreeSpec): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.ensuredSpecs.push(spec);
  }
}

export class FakeProjectPort implements ProjectPort {
  constructor(private readonly target: RunTarget | undefined) {}

  async find(): Promise<RunTarget | undefined> {
    return this.target;
  }
}

export class FakeRunTranscripts implements RunTranscripts {
  readonly sessionEntryReads: Array<{ sessionId: string; worktreePath: string }> = [];
  sessionEntries: ReadonlyArray<SessionEntry> = [];
  sessionEntriesFailure: Error | undefined;

  async readEntries(sessionId: string, worktreePath: string): Promise<ReadonlyArray<SessionEntry>> {
    this.sessionEntryReads.push({ sessionId, worktreePath });
    if (this.sessionEntriesFailure !== undefined) {
      throw this.sessionEntriesFailure;
    }
    return this.sessionEntries;
  }
}

export class SequentialIdentifiers implements Identifiers {
  private count = 0;

  next(): string {
    this.count += 1;
    return `id-${this.count}`;
  }
}

export function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    projectId: 'moritz/aisf',
    ticketNumber: 137,
    stage: 'implement',
    mode: 'afk',
    sessionId: 'session-1',
    worktreePath: '/worktrees/aisf/137',
    branchName: 'aisf/137-runner',
    state: 'running',
    startedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

export class FakeSessionFeed implements SessionFeed {
  readonly published: Array<{ runId: string; event: SessionFeedEvent }> = [];
  readonly endedRunIds: string[] = [];
  private readonly listeners = new Set<{
    runId: string;
    listener: (event: SessionFeedEvent) => void;
  }>();

  get listenerCount(): number {
    return this.listeners.size;
  }

  publish(runId: string, event: SessionFeedEvent): void {
    this.published.push({ runId, event });
    this.notify(runId, event);
  }

  entries(runId: string): ReadonlyArray<SessionEntry> {
    return this.published.flatMap((published) =>
      published.runId === runId && published.event.kind === 'entry' ? [published.event.entry] : [],
    );
  }

  subscribe(runId: string, listener: (event: SessionFeedEvent) => void): () => void {
    const registration = { runId, listener };
    this.listeners.add(registration);
    return () => {
      this.listeners.delete(registration);
    };
  }

  isActive(runId: string): boolean {
    return this.published.some((published) => published.runId === runId);
  }

  end(runId: string): void {
    this.endedRunIds.push(runId);
    this.notify(runId, { kind: 'ended' });
  }

  private notify(runId: string, event: SessionFeedEvent): void {
    for (const registration of [...this.listeners]) {
      if (registration.runId === runId) {
        registration.listener(event);
      }
    }
  }
}

export class FakeCommandLabelRepository implements CommandLabelRepository {
  readonly labelsByHash = new Map<string, string>();

  async findByCommandHash(commandHash: string): Promise<string | undefined> {
    return this.labelsByHash.get(commandHash);
  }

  async insert(commandHash: string, label: string): Promise<void> {
    if (!this.labelsByHash.has(commandHash)) {
      this.labelsByHash.set(commandHash, label);
    }
  }
}

/** Answers are scripted per call; a rejected answer is an Error to throw. */
export class FakeCommandLabeler implements CommandLabeler {
  readonly commands: string[] = [];
  private readonly answers: Array<string | Error | Promise<string>> = [];

  constructor(...answers: Array<string | Error | Promise<string>>) {
    this.answers.push(...answers);
  }

  async label(command: string): Promise<string> {
    this.commands.push(command);
    const answer = this.answers.shift() ?? '';
    if (answer instanceof Error) {
      throw answer;
    }
    return answer;
  }
}
