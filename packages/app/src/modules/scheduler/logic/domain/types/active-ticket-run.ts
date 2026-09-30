import type { RunStep } from './run-step.js';

export type ActiveTicketRun = {
  readonly id: string;
  readonly ticketNumber: number;
  readonly startedAt: string;
  readonly steps: ReadonlyArray<RunStep>;
};
