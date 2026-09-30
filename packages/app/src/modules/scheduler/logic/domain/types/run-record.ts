import type { RunEnding } from './run-ending.js';

export type RunRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly ending?: RunEnding;
};
