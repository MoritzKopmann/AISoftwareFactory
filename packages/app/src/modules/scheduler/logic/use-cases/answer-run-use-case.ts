import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import { awaitedStatusFor } from '../domain/functions/awaited-status-for.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { StartedRun } from '../domain/types/started-run.js';
import { RunNotAnswerableError } from '../errors/run-not-answerable-error.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type AnswerRunDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly runner: RunnerPort;
  readonly projectLookup: ProjectLookup;
  readonly events: EventPublisher;
};

export class AnswerRunUseCase {
  constructor(private readonly dependencies: AnswerRunDependencies) {}

  async execute(runId: string, answer: RunAnswer): Promise<StartedRun> {
    const { ticketStatusWrites, runner, projectLookup, events } = this.dependencies;

    const run = await runner.findRun(runId);
    if (run === undefined) {
      throw new RunNotAnswerableError(`Run ${runId} is unknown`);
    }
    const awaitedStatus =
      run.ending === undefined ? undefined : awaitedStatusFor(run.ending, answer);
    if (awaitedStatus === undefined) {
      throw new RunNotAnswerableError(`Run ${runId} cannot take this answer`);
    }
    const { projectId, ticketNumber } = run;

    const latestRun = await runner.latestRun(projectId, ticketNumber);
    if (latestRun?.id !== runId) {
      throw new RunNotAnswerableError(`Run ${runId} is not the latest run of #${ticketNumber}`);
    }
    const activeRuns = await runner.activeRuns(projectId);
    if (activeRuns.length > 0) {
      throw new RunNotAnswerableError(`${projectId} already has an active run`);
    }
    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      throw new RunNotAnswerableError(`${projectId} is unknown`);
    }
    if ((await ticketStatusWrites.readStatus(project.repository, ticketNumber)) !== awaitedStatus) {
      throw new RunNotAnswerableError(`#${ticketNumber} is not ${awaitedStatus}`);
    }

    await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'in-progress');
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: awaitedStatus,
      to: 'in-progress',
    });
    try {
      return await runner.resume(runId, answer);
    } catch (error) {
      await ticketStatusWrites.setStatus(project.repository, ticketNumber, awaitedStatus);
      events.emit('ticket.status-written', {
        projectId,
        ticketNumber,
        from: 'in-progress',
        to: awaitedStatus,
      });
      throw error;
    }
  }
}
