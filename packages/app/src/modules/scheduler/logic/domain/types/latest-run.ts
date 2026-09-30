import type { RunEnding } from './run-ending.js';

export type LatestRun = {
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly ending?: RunEnding;
};
