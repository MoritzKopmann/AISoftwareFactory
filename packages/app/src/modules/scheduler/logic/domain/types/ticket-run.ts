import type { RunAvailability } from './run-availability.js';
import type { RunEnding } from './run-ending.js';
import type { RunWait } from './run-wait.js';
import type { RunStep } from './run-step.js';

export type TicketRun = {
  readonly availability: RunAvailability;
  readonly activeRun?: {
    readonly id: string;
    readonly startedAt: string;
    readonly steps: ReadonlyArray<RunStep>;
    readonly waitingFor?: RunWait;
  };
  readonly lastRun?: {
    readonly id: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly ending: RunEnding;
  };
};
