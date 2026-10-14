import type { Run } from './run.js';
import type { RunStep } from './run-step.js';

export type ActiveRun = {
  readonly run: Run;
  readonly steps: ReadonlyArray<RunStep>;
};
