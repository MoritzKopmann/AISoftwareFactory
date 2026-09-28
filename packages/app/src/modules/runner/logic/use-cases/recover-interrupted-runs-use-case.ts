import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { RunRepository } from '../ports/run-repository.js';
import type { RunFinisher } from '../ports/run-finisher.js';

export type RecoverInterruptedRunsDependencies = {
  readonly runRepository: RunRepository;
  readonly finishRun: RunFinisher;
  readonly events: EventPublisher;
};

export class RecoverInterruptedRunsUseCase {
  constructor(private readonly dependencies: RecoverInterruptedRunsDependencies) {}

  async execute(): Promise<void> {
    const { runRepository, finishRun, events } = this.dependencies;

    const unsettledRuns = await runRepository.listByState('ended');
    const interruptedRuns = await runRepository.listByState('running');

    for (const run of interruptedRuns) {
      await finishRun.finish(run.id, { kind: 'app-restarted' });
    }
    for (const run of unsettledRuns) {
      if (run.ending !== undefined) {
        events.emit('run.finished', {
          runId: run.id,
          projectId: run.projectId,
          ticketNumber: run.ticketNumber,
          ending: run.ending,
        });
      }
    }
  }
}
