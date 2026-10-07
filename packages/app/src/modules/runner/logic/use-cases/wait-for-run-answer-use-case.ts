import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { FinishRun } from '../domain/types/finish-run.js';
import type { Run } from '../domain/types/run.js';
import type { RunWaitOutcome } from '../domain/types/run-wait-outcome.js';
import type { RunWait } from '../domain/types/run-wait.js';
import type { RunAnswerWaits } from '../ports/run-answer-waits.js';
import type { RunRepository } from '../ports/run-repository.js';

export type WaitForRunAnswerDependencies = {
  readonly runRepository: RunRepository;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly clock: Clock;
  readonly events: EventPublisher;
  readonly finishRun: FinishRun;
  readonly windowMilliseconds: number;
};

export class WaitForRunAnswerUseCase {
  constructor(private readonly dependencies: WaitForRunAnswerDependencies) {}

  async execute(run: Run, wait: RunWait): Promise<RunWaitOutcome> {
    const { runRepository, runAnswerWaits, clock, events, finishRun, windowMilliseconds } =
      this.dependencies;

    const outcome = await runRepository.recordWait(run.id, wait, clock.now());
    if (outcome === 'refused') {
      return {
        kind: 'unanswered',
        message:
          'This run is already waiting for an answer. Do not call this tool again: end your turn.',
      };
    }
    const pendingAnswer = runAnswerWaits.wait(run.id, windowMilliseconds);
    events.emit('run.waiting', {
      runId: run.id,
      projectId: run.projectId,
      ticketNumber: run.ticketNumber,
      wait,
    });

    const answer = await pendingAnswer;
    switch (answer.kind) {
      case 'answered':
        await runRepository.clearWait(run.id);
        return { kind: 'answered', answer: answer.answer };
      case 'expired':
        await finishRun(run.id, wait);
        return {
          kind: 'unanswered',
          message:
            'The answer window has passed. End your turn: the app resumes this session when the human answers.',
        };
      case 'cancelled':
        return { kind: 'unanswered', message: 'The run has ended. End your turn.' };
    }
  }
}
