import type { RepositoryReference } from '../../../../src/modules/scheduler/logic/domain/types/repository-reference.js';
import type { RunsBlocked } from '../../../../src/modules/scheduler/logic/domain/types/runs-blocked.js';
import type { SchedulableTicket } from '../../../../src/modules/scheduler/logic/domain/types/schedulable-ticket.js';
import type { TicketStatus } from '../../../../src/shared/ticket-status/ticket-status.js';
import type { PullRequestMerges } from '../../../../src/modules/scheduler/logic/ports/pull-request-merges.js';
import type { TicketStatusWrites } from '../../../../src/modules/scheduler/logic/ports/ticket-status-writes.js';
import type {
  ProjectLookup,
  SchedulerProject,
} from '../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import type { ReviewedTicket } from '../../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';
import type { ReviewedTicketLookup } from '../../../../src/modules/scheduler/logic/ports/reviewed-ticket-lookup.js';
import type { RunnerPort } from '../../../../src/modules/scheduler/logic/ports/runner-port.js';
import type { RunsGate } from '../../../../src/modules/scheduler/logic/ports/runs-gate.js';
import type { TicketLookup } from '../../../../src/modules/scheduler/logic/ports/ticket-lookup.js';

export const repository: RepositoryReference = { owner: 'moritz', name: 'aisf' };

export const readyLeaf: SchedulableTicket = {
  number: 138,
  status: 'ready',
  hitl: false,
  isLeaf: true,
  hasOpenBlocker: false,
  snapshotTakenAt: '2026-09-29T10:00:00.000Z',
};

export class FakeTicketStatusWrites implements TicketStatusWrites {
  readonly calls: string[] = [];
  liveStatus: TicketStatus = 'in-progress';

  async readStatus(): Promise<TicketStatus> {
    this.calls.push('readStatus');
    return this.liveStatus;
  }

  async setStatus(
    _repository: RepositoryReference,
    ticketNumber: number,
    to: TicketStatus,
  ): Promise<void> {
    this.calls.push(`setStatus #${ticketNumber} -> ${to}`);
    this.liveStatus = to;
  }

  async comment(
    _repository: RepositoryReference,
    ticketNumber: number,
    body: string,
  ): Promise<void> {
    this.calls.push(`comment #${ticketNumber}: ${body}`);
  }
}

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

export class FakeRunnerPort implements RunnerPort {
  readonly calls: string[] = [];
  activeTicketNumber: number | undefined;
  lastEndedAt: string | undefined;

  async start(request: {
    projectId: string;
    ticketNumber: number;
  }): Promise<{ readonly id: string; readonly startedAt: string }> {
    this.calls.push(`start ${request.projectId} #${request.ticketNumber}`);
    return { id: 'run-1', startedAt: '2026-09-29T09:00:00.000Z' };
  }

  async activeRun(): Promise<{ readonly ticketNumber: number } | undefined> {
    return this.activeTicketNumber === undefined
      ? undefined
      : { ticketNumber: this.activeTicketNumber };
  }

  async lastRunEndedAt(): Promise<string | undefined> {
    return this.lastEndedAt;
  }

  async settle(runId: string): Promise<void> {
    this.calls.push(`settle ${runId}`);
  }
}

export class FakeTicketLookup implements TicketLookup {
  constructor(private readonly ticket: SchedulableTicket | undefined) {}

  async find(): Promise<SchedulableTicket | undefined> {
    return this.ticket;
  }
}

export class FakeReviewedTicketLookup implements ReviewedTicketLookup {
  constructor(private readonly tickets: ReadonlyArray<ReviewedTicket>) {}

  async list(): Promise<ReadonlyArray<ReviewedTicket>> {
    return this.tickets;
  }
}

export class FakeRunsGate implements RunsGate {
  constructor(private readonly runsBlocked: RunsBlocked = { blocked: false }) {}

  check(): RunsBlocked {
    return this.runsBlocked;
  }
}

export class FakeProjectLookup implements ProjectLookup {
  constructor(
    private readonly project: SchedulerProject | undefined = { repository, onboarded: true },
  ) {}

  async find(): Promise<SchedulerProject | undefined> {
    return this.project;
  }
}
