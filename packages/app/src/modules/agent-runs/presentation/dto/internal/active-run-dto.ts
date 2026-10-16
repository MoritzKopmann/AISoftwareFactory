import type { RunDto } from './run-dto.js';
import type { RunStepDto } from './run-step-dto.js';

export type ActiveRunDto = {
  readonly run: RunDto;
  readonly steps: ReadonlyArray<RunStepDto>;
};
