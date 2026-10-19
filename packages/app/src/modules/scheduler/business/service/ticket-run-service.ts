import type { Logger } from '../../../../shared/logger/create-logger.js';
import { awaitedStatusFor } from '../domain/functions/awaited-status-for.js';
import { determineRunAvailability } from '../domain/functions/determine-run-availability.js';
import { ideaFromText } from '../domain/functions/idea-from-text.js';
import { rankDueTickets } from '../domain/functions/rank-due-tickets.js';
import type { RunAnswerOutcome } from '../domain/types/run-answer-outcome.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { RunAvailability } from '../domain/types/run-availability.js';
import type { StartedRun } from '../domain/types/started-run.js';
import type { TicketRun } from '../domain/types/ticket-run.js';
import { IdeaRunNotStartedError } from '../errors/idea-run-not-started-error.js';
import { ProjectNotFoundError } from '../errors/project-not-found-error.js';
import { RunAlreadyActiveError } from '../errors/run-already-active-error.js';
import { RunNotAnswerableError } from '../errors/run-not-answerable-error.js';
import { RunNotAvailableError } from '../errors/run-not-available-error.js';
import type { ProjectPort } from '../port/project/project-port.js';
import type { RunPort } from '../port/run/run-port.js';
import type { SkillPort } from '../port/skill/skill-port.js';
import type { TicketPort } from '../port/ticket/ticket-port.js';
import type { UsagePort } from '../port/usage/usage-port.js';

export type TicketRunServiceDependencies = {
  readonly ticketPort: Pick<TicketPort, 'find' | 'list' | 'create' | 'begin' | 'revert'>;
  readonly runPort: RunPort;
  readonly skillPort: SkillPort;
  readonly projectPort: ProjectPort;
  readonly usagePort: UsagePort;
  readonly logger: Logger;
};

function isRepeatingRefusal(error: unknown): boolean {
  return error instanceof RunNotAvailableError || error instanceof RunAlreadyActiveError;
}

export class TicketRunService {
  private readonly ticketsBeingStarted = new Set<string>();

  constructor(private readonly dependencies: TicketRunServiceDependencies) {}

  async readAvailability(
    projectId: string,
    ticketNumber: number,
    trigger: 'manual' | 'auto' = 'manual',
  ): Promise<RunAvailability> {
    const { ticketPort, runPort, skillPort, projectPort, usagePort } = this.dependencies;

    const [ticket, activeRuns, latestRun, project, usagePausedUntil] = await Promise.all([
      ticketPort.find(projectId, ticketNumber),
      runPort.activeRuns(projectId),
      runPort.latestRun(projectId, ticketNumber),
      projectPort.find(projectId),
      usagePort.pausedUntil(),
    ]);

    const subIssues =
      ticket?.status === 'plan'
        ? await Promise.all(
            ticket.subIssueNumbers.map((number) => ticketPort.find(projectId, number)),
          )
        : [];
    const lastRunEndedAt = latestRun?.endedAt;
    return determineRunAvailability({
      ...(ticket === undefined ? {} : { ticket }),
      subIssues: subIssues.filter((subIssue) => subIssue !== undefined),
      ticketIsRunning: activeRuns.some(({ run }) => run.ticketNumber === ticketNumber),
      ...(lastRunEndedAt === undefined ? {} : { lastRunEndedAt }),
      runsBlocked: skillPort.check(),
      projectOnboarded: project?.onboarded === true,
      trigger,
      projectPaused: project?.paused === true,
      ...(usagePausedUntil === undefined ? {} : { usagePausedUntil }),
    });
  }

  async readTicketRun(projectId: string, ticketNumber: number): Promise<TicketRun> {
    const { runPort } = this.dependencies;

    const [availability, activeRuns, latestRun] = await Promise.all([
      this.readAvailability(projectId, ticketNumber),
      runPort.activeRuns(projectId),
      runPort.latestRun(projectId, ticketNumber),
    ]);

    const activeRun = activeRuns.find(({ run }) => run.ticketNumber === ticketNumber);
    const waitingFor = activeRun?.run.waitingFor;
    return {
      availability,
      ...(activeRun !== undefined
        ? {
            activeRun: {
              id: activeRun.run.id,
              startedAt: activeRun.run.startedAt,
              answerHeld: activeRun.run.answerHeld,
              ...(waitingFor === undefined ? {} : { waitingFor }),
              ...(activeRun.run.waitingSince === undefined
                ? {}
                : { waitingSince: activeRun.run.waitingSince }),
            },
          }
        : {}),
      ...(latestRun?.ending !== undefined && latestRun.endedAt !== undefined
        ? {
            lastRun: {
              id: latestRun.id,
              startedAt: latestRun.startedAt,
              answerHeld: latestRun.answerHeld,
              endedAt: latestRun.endedAt,
              ending: latestRun.ending,
            },
          }
        : {}),
    };
  }

  async start(projectId: string, ticketNumber: number): Promise<StartedRun> {
    return this.startWith(projectId, ticketNumber, 'manual');
  }

  async startDue(projectId: string): Promise<ReadonlyArray<StartedRun>> {
    const { ticketPort, logger } = this.dependencies;

    const dueTickets = rankDueTickets(await ticketPort.list(projectId));
    const startedRuns: StartedRun[] = [];
    for (const { number } of dueTickets) {
      const key = `${projectId}#${number}`;
      if (this.ticketsBeingStarted.has(key)) {
        continue;
      }
      this.ticketsBeingStarted.add(key);
      try {
        startedRuns.push(await this.startWith(projectId, number, 'auto'));
      } catch (error) {
        if (!isRepeatingRefusal(error)) {
          logger.error(
            `Starting #${number} of ${projectId} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } finally {
        this.ticketsBeingStarted.delete(key);
      }
    }
    return startedRuns;
  }

  private async startWith(
    projectId: string,
    ticketNumber: number,
    trigger: 'manual' | 'auto',
  ): Promise<StartedRun> {
    const availability = await this.readAvailability(projectId, ticketNumber, trigger);
    if (availability.kind === 'absent') {
      throw new RunNotAvailableError(`Ticket #${ticketNumber} cannot be run`);
    }
    if (availability.kind === 'disabled') {
      throw new RunNotAvailableError(availability.reason);
    }
    const ticket = await this.dependencies.ticketPort.find(projectId, ticketNumber);
    if (ticket === undefined) {
      throw new RunNotAvailableError(`Ticket #${ticketNumber} cannot be run`);
    }
    return this.dependencies.runPort.start({
      projectId,
      ticketNumber,
      ticketTitle: ticket.title,
      status: ticket.status,
      types: ticket.types,
    });
  }

  async startIdeaSession(projectId: string, text: string): Promise<number> {
    const { projectPort, skillPort, ticketPort } = this.dependencies;

    const project = await projectPort.find(projectId);
    if (project === undefined) {
      throw new ProjectNotFoundError(`Project ${projectId} is not registered`);
    }
    if (!project.onboarded) {
      throw new RunNotAvailableError('The project is not onboarded');
    }
    const runsBlocked = skillPort.check();
    if (runsBlocked.blocked) {
      throw new RunNotAvailableError(runsBlocked.reason);
    }

    const ticketNumber = await ticketPort.create(project.repository, ideaFromText(text));
    try {
      await this.start(projectId, ticketNumber);
    } catch (error) {
      if (error instanceof RunNotAvailableError || error instanceof RunAlreadyActiveError) {
        throw new IdeaRunNotStartedError(ticketNumber, error.message);
      }
      throw error;
    }
    return ticketNumber;
  }

  async answer(runId: string, answer: RunAnswer): Promise<RunAnswerOutcome> {
    const { runPort, usagePort } = this.dependencies;

    const run = await runPort.findRun(runId);
    if (run === undefined) {
      throw new RunNotAnswerableError(`Run ${runId} is unknown`);
    }
    const awaited = run.waitingFor ?? run.ending;
    const awaitedStatus = awaited === undefined ? undefined : awaitedStatusFor(awaited, answer);
    if (awaitedStatus === undefined) {
      throw new RunNotAnswerableError(`Run ${runId} cannot take this answer`);
    }
    const { projectId, ticketNumber } = run;

    const latestRun = await runPort.latestRun(projectId, ticketNumber);
    if (latestRun?.id !== runId) {
      throw new RunNotAnswerableError(`Run ${runId} is not the latest run of #${ticketNumber}`);
    }
    const pausedUntil = await usagePort.pausedUntil();
    if (pausedUntil !== undefined) {
      await runPort.holdAnswer(runId, answer);
      return { kind: 'held', pausedUntil };
    }
    return {
      kind: 'answered',
      run: await this.deliverAnswer(projectId, ticketNumber, runId, answer),
    };
  }

  /** At the reset: resume each paused run of the project, then the caller starts due work. */
  async continuePaused(projectId: string): Promise<void> {
    const { runPort, logger } = this.dependencies;

    if (await this.isUsagePaused()) {
      return;
    }
    for (const { runId, ticketNumber, heldAnswer } of await runPort.pausedRuns(projectId)) {
      const key = `${projectId}#${ticketNumber}`;
      if (this.ticketsBeingStarted.has(key)) {
        continue;
      }
      this.ticketsBeingStarted.add(key);
      try {
        if (await this.isStuck(projectId, ticketNumber)) {
          continue;
        }
        if (heldAnswer === undefined) {
          await runPort.resumePaused(runId);
        } else {
          await this.deliverAnswer(projectId, ticketNumber, runId, heldAnswer);
        }
      } catch (error) {
        logger.error(
          `Continuing run ${runId} of #${ticketNumber} of ${projectId} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        this.ticketsBeingStarted.delete(key);
      }
    }
  }

  private async isUsagePaused(): Promise<boolean> {
    return (await this.dependencies.usagePort.pausedUntil()) !== undefined;
  }

  private async isStuck(projectId: string, ticketNumber: number): Promise<boolean> {
    const ticket = await this.dependencies.ticketPort.find(projectId, ticketNumber);
    return ticket?.stuck === true;
  }

  private async deliverAnswer(
    projectId: string,
    ticketNumber: number,
    runId: string,
    answer: RunAnswer,
  ): Promise<StartedRun> {
    const { ticketPort, runPort } = this.dependencies;

    await ticketPort.begin(projectId, ticketNumber);
    try {
      return await runPort.answer(runId, answer);
    } catch (error) {
      await ticketPort.revert(projectId, ticketNumber);
      throw error;
    }
  }
}
