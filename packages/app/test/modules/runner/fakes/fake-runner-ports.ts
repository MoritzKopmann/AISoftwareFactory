import { RunAlreadyActiveError } from '../../../../src/modules/runner/logic/errors/run-already-active-error.js';
import type { Run } from '../../../../src/modules/runner/logic/domain/types/run.js';
import type { RunEnding } from '../../../../src/modules/runner/logic/domain/types/run-ending.js';
import type { RunStep } from '../../../../src/modules/runner/logic/domain/types/run-step.js';
import type { SessionLogEntry } from '../../../../src/modules/runner/logic/domain/types/session-log-entry.js';
import type { RunTarget } from '../../../../src/modules/runner/logic/domain/types/run-target.js';
import type { SessionEvent } from '../../../../src/modules/runner/logic/domain/types/session-event.js';
import type { ResumeSessionSpec } from '../../../../src/modules/runner/logic/domain/types/resume-session-spec.js';
import type { SessionSpec } from '../../../../src/modules/runner/logic/domain/types/session-spec.js';
import type { WorktreeSpec } from '../../../../src/modules/runner/logic/domain/types/worktree-spec.js';
import type { AgentSessions } from '../../../../src/modules/runner/logic/ports/agent-sessions.js';
import type { Identifiers } from '../../../../src/modules/runner/logic/ports/identifiers.js';
import type { RecentRunSteps } from '../../../../src/modules/runner/logic/ports/recent-run-steps.js';
import type { RunRepository } from '../../../../src/modules/runner/logic/ports/run-repository.js';
import type { RunTargets } from '../../../../src/modules/runner/logic/ports/run-targets.js';
import type { SessionTranscripts } from '../../../../src/modules/runner/logic/ports/session-transcripts.js';
import type { Worktrees } from '../../../../src/modules/runner/logic/ports/worktrees.js';

export class FakeRunRepository implements RunRepository {
  readonly runs = new Map<string, Run>();

  async insert(run: Run): Promise<void> {
    const runningRun = [...this.runs.values()].find(
      (existing) => existing.projectId === run.projectId && existing.state === 'running',
    );
    if (runningRun !== undefined && run.state === 'running') {
      throw new RunAlreadyActiveError(`${run.projectId} already has a running run`);
    }
    this.runs.set(run.id, run);
  }

  async findById(runId: string): Promise<Run | undefined> {
    return this.runs.get(runId);
  }

  async findActive(projectId: string): Promise<Run | undefined> {
    return [...this.runs.values()].find(
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
    this.runs.set(runId, { ...run, state: 'ended', ending, endedAt });
    return 'recorded';
  }

  async markSettled(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run !== undefined) {
      this.runs.set(runId, { ...run, state: 'settled' });
    }
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
  failure: Error | undefined;

  async ensure(spec: WorktreeSpec): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.ensuredSpecs.push(spec);
  }
}

export class FakeRunTargets implements RunTargets {
  constructor(private readonly target: RunTarget | undefined) {}

  async find(): Promise<RunTarget | undefined> {
    return this.target;
  }
}

export class FakeSessionTranscripts implements SessionTranscripts {
  readonly reads: Array<{ sessionId: string; worktreePath: string }> = [];
  entries: ReadonlyArray<SessionLogEntry> = [];
  failure: Error | undefined;

  async read(sessionId: string, worktreePath: string): Promise<ReadonlyArray<SessionLogEntry>> {
    this.reads.push({ sessionId, worktreePath });
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.entries;
  }
}

export class FakeRecentRunSteps implements RecentRunSteps {
  private readonly stepsByRunId = new Map<string, RunStep[]>();

  append(runId: string, step: RunStep): void {
    this.stepsByRunId.set(runId, [...(this.stepsByRunId.get(runId) ?? []), step]);
  }

  read(runId: string): ReadonlyArray<RunStep> {
    return this.stepsByRunId.get(runId) ?? [];
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
