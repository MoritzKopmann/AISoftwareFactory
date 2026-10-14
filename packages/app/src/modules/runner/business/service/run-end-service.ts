import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import { endingForWaitingRun } from '../domain/functions/ending-for-waiting-run.js';
import type { RunEnding } from '../domain/types/run-ending.js';
import { RunNotActiveError } from '../errors/run-not-active-error.js';
import type { RunAnswerWaits } from '../port/repository/run-answer-waits.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { AgentSessions } from '../port/session/agent-sessions.js';

export type RunEndServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly agentSessions: AgentSessions;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly clock: Clock;
  readonly events: EventPublisher;
};

/** Ends runs: a run finishes, is stopped, is settled, or is recovered after a crash. */
export class RunEndService {
  constructor(private readonly dependencies: RunEndServiceDependencies) {}

  async finish(runId: string, requestedEnding: RunEnding): Promise<void> {
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
      stage: run.stage,
      ending,
    });
  }

  async stop(runId: string): Promise<void> {
    const run = await this.dependencies.runRepository.findById(runId);
    if (run?.state !== 'running') {
      throw new RunNotActiveError(`Run ${runId} is not running`);
    }

    await this.finish(runId, { kind: 'stopped' });
  }

  async settle(runId: string): Promise<void> {
    await this.dependencies.runRepository.markSettled(runId, this.dependencies.clock.now());
  }

  async recoverInterrupted(): Promise<void> {
    const { runRepository, events } = this.dependencies;

    const unsettledRuns = await runRepository.listByState('ended');
    const interruptedRuns = await runRepository.listByState('running');

    for (const run of interruptedRuns) {
      await this.finish(run.id, { kind: 'app-restarted' });
    }
    for (const run of unsettledRuns) {
      if (run.ending !== undefined) {
        events.emit('run.finished', {
          runId: run.id,
          projectId: run.projectId,
          ticketNumber: run.ticketNumber,
          stage: run.stage,
          ending: run.ending,
        });
      }
    }
  }

  abortSessions(): void {
    this.dependencies.agentSessions.stopAll();
  }
}
