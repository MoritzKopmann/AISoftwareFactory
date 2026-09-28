import type { RunStep } from '../domain/types/run-step.js';

export interface RecentRunSteps {
  append(runId: string, step: RunStep): void;
  read(runId: string): ReadonlyArray<RunStep>;
}
