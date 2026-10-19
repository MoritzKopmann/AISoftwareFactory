import type { RepositoryReference } from '../business/domain/types/repository-reference.js';
import type { RunsBlocked } from '../business/domain/types/runs-blocked.js';
import type { SchedulableTicket } from '../business/domain/types/schedulable-ticket.js';
import type { PullRequestMerges } from '../business/port/github/pull-request-merges.js';
import type { ProjectPort, SchedulerProject } from '../business/port/project/project-port.js';
import type { ReviewedTicket } from '../business/domain/types/reviewed-ticket.js';
import type { ActiveTicketRun } from '../business/domain/types/active-ticket-run.js';
import type { LatestRun } from '../business/domain/types/latest-run.js';
import type { RunWait } from '../business/domain/types/run-wait.js';
import type { RunAnswer } from '../business/domain/types/run-answer.js';
import type { RunRecord } from '../business/domain/types/run-record.js';
import type { RunPort } from '../business/port/run/run-port.js';
import type { PausedRun } from '../business/domain/types/paused-run.js';
import type { StartedRun } from '../business/domain/types/started-run.js';
import type { UsagePort } from '../business/port/usage/usage-port.js';
import type { SkillPort } from '../business/port/skill/skill-port.js';
import type { TicketPort } from '../business/port/ticket/ticket-port.js';

export const repository: RepositoryReference = { owner: 'moritz', name: 'aisf' };

export const readyLeaf: SchedulableTicket = {
  number: 138,
  title: 'Add login',
  status: 'ready',
  types: [],
  isLeaf: true,
  hasOpenBlocker: false,
  stuck: false,
  waiting: false,
  syncFailed: false,
  subIssueNumbers: [],
  snapshotTakenAt: '2026-09-29T10:00:00.000Z',
};

export class FakePullRequestMerges implements PullRequestMerges {
  readonly calls: string[] = [];
  mergeError: Error | undefined;
  mergeGate: Promise<void> = Promise.resolve();

  async merge(
    _repository: RepositoryReference,
    pullRequestNumber: number,
    headCommit: string,
  ): Promise<void> {
    this.calls.push(`merge #${pullRequestNumber} ${headCommit}`);
    await this.mergeGate;
    if (this.mergeError !== undefined) {
      throw this.mergeError;
    }
  }
}

export class FakeRunPort implements RunPort {
  readonly calls: string[] = [];
  activeTicketNumbers: ReadonlyArray<number> = [];
  activeWaitingFor: RunWait | undefined;
  activeWaitingSince: string | undefined;
  latest: LatestRun | undefined;
  record: RunRecord | undefined;
  startFailure: Error | undefined;
  startFailureTicket: number | undefined;
  startGate: Promise<void> = Promise.resolve();
  answerFailure: Error | undefined;
  paused: ReadonlyArray<PausedRun> = [];

  readonly startRequests: Array<Parameters<RunPort['start']>[0]> = [];

  async start(request: Parameters<RunPort['start']>[0]): Promise<StartedRun> {
    this.startRequests.push(request);
    this.calls.push(`start ${request.projectId} #${request.ticketNumber}`);
    await this.startGate;
    if (
      this.startFailure !== undefined &&
      (this.startFailureTicket === undefined || this.startFailureTicket === request.ticketNumber)
    ) {
      throw this.startFailure;
    }
    return { id: 'run-1', startedAt: '2026-09-29T09:00:00.000Z' };
  }

  async findRun(runId: string): Promise<RunRecord | undefined> {
    this.calls.push(`findRun ${runId}`);
    return this.record;
  }

  async answer(runId: string, answer: RunAnswer): Promise<StartedRun> {
    this.calls.push(`answer ${runId} ${JSON.stringify(answer)}`);
    if (this.answerFailure !== undefined) {
      throw this.answerFailure;
    }
    return { id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' };
  }

  async pausedRuns(): Promise<ReadonlyArray<PausedRun>> {
    return this.paused;
  }

  async holdAnswer(runId: string, answer: RunAnswer): Promise<void> {
    this.calls.push(`holdAnswer ${runId} ${JSON.stringify(answer)}`);
  }

  async resumePaused(runId: string): Promise<StartedRun> {
    this.calls.push(`resumePaused ${runId}`);
    return { id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' };
  }

  async activeRuns(): Promise<ReadonlyArray<ActiveTicketRun>> {
    return this.activeTicketNumbers.map((ticketNumber) => ({
      run: {
        id: 'run-1',
        ticketNumber,
        startedAt: '2026-09-29T09:00:00.000Z',
        answerHeld: false,
        ...(this.activeWaitingFor === undefined ? {} : { waitingFor: this.activeWaitingFor }),
        ...(this.activeWaitingSince === undefined ? {} : { waitingSince: this.activeWaitingSince }),
      },
    }));
  }

  async latestRun(): Promise<LatestRun | undefined> {
    return this.latest;
  }
}

export class FakeUsagePort implements UsagePort {
  pausedUntilValue: string | undefined;

  async pausedUntil(): Promise<string | undefined> {
    return this.pausedUntilValue;
  }
}

export class FakeSkillPort implements SkillPort {
  constructor(private readonly runsBlocked: RunsBlocked = { blocked: false }) {}

  check(): RunsBlocked {
    return this.runsBlocked;
  }
}

export class FakeProjectPort implements ProjectPort {
  constructor(
    private readonly project: SchedulerProject | undefined = {
      repository,
      onboarded: true,
      paused: false,
    },
  ) {}

  async find(): Promise<SchedulerProject | undefined> {
    return this.project;
  }
}

export class FakeTicketPort implements TicketPort {
  readonly calls: string[] = [];
  beginFailure: Error | undefined;
  createdNumber = 501;

  constructor(
    private readonly ticket: SchedulableTicket | undefined,
    private readonly subIssues: ReadonlyArray<SchedulableTicket> = [],
    private readonly reviewed: ReadonlyArray<ReviewedTicket> = [],
  ) {}

  async find(_projectId: string, ticketNumber: number): Promise<SchedulableTicket | undefined> {
    return this.subIssues.find(({ number }) => number === ticketNumber) ?? this.ticket;
  }

  async list(): Promise<ReadonlyArray<ReviewedTicket>> {
    return this.reviewed;
  }

  async create(
    _repository: RepositoryReference,
    idea: { readonly title: string; readonly body: string },
  ): Promise<number> {
    this.calls.push(`create ${JSON.stringify(idea)}`);
    return this.createdNumber;
  }

  async begin(projectId: string, ticketNumber: number): Promise<void> {
    this.calls.push(`begin ${projectId} #${ticketNumber}`);
    if (this.beginFailure !== undefined) {
      throw this.beginFailure;
    }
  }

  async revert(projectId: string, ticketNumber: number): Promise<void> {
    this.calls.push(`revert ${projectId} #${ticketNumber}`);
  }
}
