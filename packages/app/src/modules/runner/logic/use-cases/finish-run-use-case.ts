import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import { endingForWaitingRun } from '../domain/functions/ending-for-waiting-run.js';
import type { RunEnding } from '../domain/types/run-ending.js';
import type { AgentSessions } from '../ports/agent-sessions.js';
import type { RunAnswerWaits } from '../ports/run-answer-waits.js';
import type { RunRepository } from '../ports/run-repository.js';

export type FinishRunDependencies = {
  readonly runRepository: RunRepository;
  readonly agentSessions: AgentSessions;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly clock: Clock;
  readonly events: EventPublisher;
};

export class FinishRunUseCase {
  constructor(private readonly dependencies: FinishRunDependencies) {}

  async execute(runId: string, requestedEnding: RunEnding): Promise<void> {
    const { runRepository, agentSessions, runAnswerWaits, clock, events } = this.dependencies;

    const run = await runRepository.findById(runId);
    if (run === undefined) {
      return;
    }

    const ending = endingForWaitingRun(run, requestedEnding);
    const outcome = await runRepository.recordEnding(runId, ending, clock.now());
    if (outcome === 'already-ended') {
      return;
    }

    runAnswerWaits.cancel(runId);
    agentSessions.stop(run.sessionId);
    events.emit('run.finished', {
      runId,
      projectId: run.projectId,
      ticketNumber: run.ticketNumber,
      ending,
    });
  }
}
