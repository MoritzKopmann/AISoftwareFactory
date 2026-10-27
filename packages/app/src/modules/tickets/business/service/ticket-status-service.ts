import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import {
  decideRunEndTransition,
  needsSpikeCheck,
} from '../domain/functions/decide-run-end-transition.js';
import type { FinishedRun } from '../domain/types/finished-run.js';
import type { RepositoryReference } from '../domain/types/repository-reference.js';
import type { RunEndTransition } from '../domain/types/run-end-transition.js';
import type { TicketLiveState } from '../domain/types/ticket-live-state.js';
import type { WaitingRun } from '../domain/types/waiting-run.js';
import { TicketNotAnswerableError } from '../errors/ticket-not-answerable-error.js';
import { TicketNotMovableError } from '../errors/ticket-not-movable-error.js';
import { TicketNotResettableError } from '../errors/ticket-not-resettable-error.js';
import type { TicketStatusWrites } from '../port/github/ticket-status-writes.js';
import type { ProjectPort } from '../port/project/project-port.js';
import type { RunPort } from '../port/run/run-port.js';

export type TicketStatusServiceDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly runPort: Pick<RunPort, 'activeRunTicketNumbers' | 'settle'>;
  readonly projectPort: ProjectPort;
  readonly events: EventPublisher;
  readonly logger: Logger;
};

type RegisteredProject = {
  readonly projectId: string;
  readonly repository: RepositoryReference;
};

export class TicketStatusService {
  constructor(private readonly dependencies: TicketStatusServiceDependencies) {}

  async beginAnswer(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, events } = this.dependencies;

    const project = await this.findProject(projectId);
    if (project === undefined) {
      throw new TicketNotAnswerableError(`${projectId} is unknown`);
    }
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    if (!live.waiting) {
      throw new TicketNotAnswerableError(`#${ticketNumber} is not waiting`);
    }
    await ticketStatusWrites.setSecondaryState(project.repository, ticketNumber, 'waiting', false);
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: live.status,
      to: live.status,
      waiting: false,
      stuck: live.stuck,
    });
  }

  async revertAnswer(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, events } = this.dependencies;

    const project = await this.findProject(projectId);
    if (project === undefined) {
      throw new TicketNotAnswerableError(`${projectId} is unknown`);
    }
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    await ticketStatusWrites.setSecondaryState(project.repository, ticketNumber, 'waiting', true);
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: live.status,
      to: live.status,
      waiting: true,
      stuck: live.stuck,
    });
  }

  async reset(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, runPort, events } = this.dependencies;

    const project = await this.findProject(projectId);
    if (project === undefined) {
      throw new TicketNotResettableError(`${projectId} is unknown`);
    }
    if ((await runPort.activeRunTicketNumbers(projectId)).includes(ticketNumber)) {
      throw new TicketNotResettableError(`#${ticketNumber} has an active run`);
    }
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    if (live.status !== 'in-progress' && !live.stuck) {
      throw new TicketNotResettableError(`#${ticketNumber} is not stuck or in progress`);
    }

    // A ticket keeps its status. The scheduler never runs an in-progress ticket, so it goes back to ready.
    const isInProgress = live.status === 'in-progress';
    const status = isInProgress ? 'ready' : live.status;
    if (isInProgress) {
      await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'ready');
    }
    for (const state of ['waiting', 'stuck'] as const) {
      if (live[state]) {
        await ticketStatusWrites.setSecondaryState(project.repository, ticketNumber, state, false);
      }
    }
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: live.status,
      to: status,
      waiting: false,
      stuck: false,
    });
  }

  async moveToPlan(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, events } = this.dependencies;

    const project = await this.findProject(projectId);
    if (project === undefined) {
      throw new TicketNotMovableError(`${projectId} is unknown`);
    }
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    if (live.status !== 'backlog') {
      throw new TicketNotMovableError(`#${ticketNumber} is not in backlog`);
    }
    await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'plan');
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: 'backlog',
      to: 'plan',
      waiting: live.waiting,
      stuck: live.stuck,
    });
  }

  async settleFinishedRun(finishedRun: FinishedRun): Promise<void> {
    const { ticketStatusWrites, runPort, logger } = this.dependencies;
    const { runId, projectId, ticketNumber, stage, ending } = finishedRun;

    const project = await this.findProject(projectId);
    if (project === undefined) {
      logger.warn(
        `Run ${runId} ended but ${projectId} is unknown, so #${ticketNumber} is unchanged`,
      );
      await runPort.settle(runId);
      return;
    }

    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    const hasOpenSpike = needsSpikeCheck(ending, live, stage)
      ? await ticketStatusWrites.hasOpenSpike(project.repository, ticketNumber)
      : true;
    await this.applyTransition(
      project,
      ticketNumber,
      live,
      decideRunEndTransition(ending, live, stage, hasOpenSpike),
    );
    await runPort.settle(runId);
  }

  async settleWaitingRun(waitingRun: WaitingRun): Promise<void> {
    const { ticketStatusWrites, logger } = this.dependencies;
    const { runId, projectId, ticketNumber, stage, wait } = waitingRun;

    const project = await this.findProject(projectId);
    if (project === undefined) {
      logger.warn(
        `Run ${runId} waits but ${projectId} is unknown, so #${ticketNumber} is unchanged`,
      );
      return;
    }

    // The run is still running: the same end rule applies, but nothing is settled.
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    await this.applyTransition(
      project,
      ticketNumber,
      live,
      decideRunEndTransition(wait, live, stage),
    );
  }

  private async findProject(projectId: string): Promise<RegisteredProject | undefined> {
    return (await this.dependencies.projectPort.list()).find(
      (registered) => registered.projectId === projectId,
    );
  }

  private async applyTransition(
    project: RegisteredProject,
    ticketNumber: number,
    live: TicketLiveState,
    transition: RunEndTransition,
  ): Promise<void> {
    const { ticketStatusWrites, events } = this.dependencies;
    const { projectId, repository } = project;

    if (transition.kind === 'return-to-ready') {
      await ticketStatusWrites.setStatus(repository, ticketNumber, 'ready');
      events.emit('ticket.status-written', {
        projectId,
        ticketNumber,
        from: live.status,
        to: 'ready',
        waiting: live.waiting,
        stuck: live.stuck,
      });
    }
    if (transition.kind === 'flag') {
      const becomesStuck = transition.state === 'stuck';
      if (becomesStuck && live.waiting) {
        await ticketStatusWrites.setSecondaryState(repository, ticketNumber, 'waiting', false);
      }
      await ticketStatusWrites.setSecondaryState(repository, ticketNumber, transition.state, true);
      events.emit('ticket.status-written', {
        projectId,
        ticketNumber,
        from: live.status,
        to: live.status,
        waiting: !becomesStuck,
        stuck: becomesStuck || live.stuck,
      });
      await ticketStatusWrites.comment(repository, ticketNumber, transition.comment);
    }
  }
}
