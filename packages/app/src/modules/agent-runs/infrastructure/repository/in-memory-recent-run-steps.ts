import type { RunStep } from '../../business/domain/types/run-step.js';
import type { RecentRunSteps } from '../../business/port/repository/recent-run-steps.js';

const retainedStepCount = 5;

export class InMemoryRecentRunSteps implements RecentRunSteps {
  private readonly stepsByRunId = new Map<string, ReadonlyArray<RunStep>>();

  append(runId: string, step: RunStep): void {
    const steps = [...(this.stepsByRunId.get(runId) ?? []), step];
    this.stepsByRunId.set(runId, steps.slice(-retainedStepCount));
  }

  read(runId: string): ReadonlyArray<RunStep> {
    return this.stepsByRunId.get(runId) ?? [];
  }
}
