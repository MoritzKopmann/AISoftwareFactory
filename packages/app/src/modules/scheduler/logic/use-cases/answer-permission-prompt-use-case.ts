import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { PermissionDecision } from '../domain/types/permission-decision.js';
import type { StartedRun } from '../domain/types/started-run.js';
import { PermissionNotAnswerableError } from '../errors/permission-not-answerable-error.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type AnswerPermissionPromptDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly runner: RunnerPort;
  readonly projectLookup: ProjectLookup;
  readonly events: EventPublisher;
};

export class AnswerPermissionPromptUseCase {
  constructor(private readonly dependencies: AnswerPermissionPromptDependencies) {}

  async execute(runId: string, decision: PermissionDecision): Promise<StartedRun> {
    const { ticketStatusWrites, runner, projectLookup, events } = this.dependencies;

    const run = await runner.findRun(runId);
    if (run === undefined) {
      throw new PermissionNotAnswerableError(`Run ${runId} is unknown`);
    }
    if (run.ending?.kind !== 'permission-needed') {
      throw new PermissionNotAnswerableError(`Run ${runId} did not end needing permission`);
    }
    const { projectId, ticketNumber } = run;

    const latestRun = await runner.latestRun(projectId, ticketNumber);
    if (latestRun?.id !== runId) {
      throw new PermissionNotAnswerableError(
        `Run ${runId} is not the latest run of #${ticketNumber}`,
      );
    }
    const activeRuns = await runner.activeRuns(projectId);
    if (activeRuns.some((active) => active.run.ticketNumber === ticketNumber)) {
      throw new PermissionNotAnswerableError(`#${ticketNumber} already has an active run`);
    }
    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      throw new PermissionNotAnswerableError(`${projectId} is unknown`);
    }
    if ((await ticketStatusWrites.readStatus(project.repository, ticketNumber)) !== 'stuck') {
      throw new PermissionNotAnswerableError(`#${ticketNumber} is not stuck`);
    }

    await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'in-progress');
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: 'stuck',
      to: 'in-progress',
    });
    try {
      return await runner.resume(runId, decision);
    } catch (error) {
      await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'stuck');
      events.emit('ticket.status-written', {
        projectId,
        ticketNumber,
        from: 'in-progress',
        to: 'stuck',
      });
      throw error;
    }
  }
}
