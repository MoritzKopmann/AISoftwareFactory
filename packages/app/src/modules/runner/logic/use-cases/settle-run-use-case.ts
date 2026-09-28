import type { Clock } from '../../../../shared/clock/clock.js';
import type { RunRepository } from '../ports/run-repository.js';

export type SettleRunDependencies = {
  readonly runRepository: RunRepository;
  readonly clock: Clock;
};

export class SettleRunUseCase {
  constructor(private readonly dependencies: SettleRunDependencies) {}

  async execute(runId: string): Promise<void> {
    await this.dependencies.runRepository.markSettled(runId, this.dependencies.clock.now());
  }
}
