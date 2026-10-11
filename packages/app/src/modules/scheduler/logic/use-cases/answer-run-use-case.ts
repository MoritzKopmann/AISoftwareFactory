import { awaitedStatusFor } from '../domain/functions/awaited-status-for.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { StartedRun } from '../domain/types/started-run.js';
import { RunNotAnswerableError } from '../errors/run-not-answerable-error.js';
import type { RunnerPort } from '../ports/runner-port.js';
import type { TicketAnswerGate } from '../ports/ticket-answer-gate.js';

export type AnswerRunDependencies = {
  readonly ticketAnswerGate: TicketAnswerGate;
  readonly runner: RunnerPort;
};

export class AnswerRunUseCase {
  constructor(private readonly dependencies: AnswerRunDependencies) {}

  async execute(runId: string, answer: RunAnswer): Promise<StartedRun> {
    const { ticketAnswerGate, runner } = this.dependencies;

    const run = await runner.findRun(runId);
    if (run === undefined) {
      throw new RunNotAnswerableError(`Run ${runId} is unknown`);
    }
    const awaited = run.waitingFor ?? run.ending;
    const awaitedStatus = awaited === undefined ? undefined : awaitedStatusFor(awaited, answer);
    if (awaitedStatus === undefined) {
      throw new RunNotAnswerableError(`Run ${runId} cannot take this answer`);
    }
    const { projectId, ticketNumber } = run;

    const latestRun = await runner.latestRun(projectId, ticketNumber);
    if (latestRun?.id !== runId) {
      throw new RunNotAnswerableError(`Run ${runId} is not the latest run of #${ticketNumber}`);
    }
    await ticketAnswerGate.begin(projectId, ticketNumber);
    try {
      return await runner.answer(runId, answer);
    } catch (error) {
      await ticketAnswerGate.revert(projectId, ticketNumber);
      throw error;
    }
  }
}
