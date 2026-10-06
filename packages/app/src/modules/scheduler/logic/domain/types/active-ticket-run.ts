import type { RunWait } from './run-wait.js';
import type { RunStep } from './run-step.js';

export type ActiveTicketRun = {
  readonly run: {
    readonly id: string;
    readonly ticketNumber: number;
    readonly startedAt: string;
    readonly waitingFor?: RunWait;
  };
  readonly steps: ReadonlyArray<RunStep>;
};
