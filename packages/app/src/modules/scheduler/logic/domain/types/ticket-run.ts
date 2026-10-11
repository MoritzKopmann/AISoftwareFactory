import type { RunAvailability } from './run-availability.js';
import type { RunEnding } from './run-ending.js';
import type { RunStep } from './run-step.js';
import type { TicketRunWait } from './ticket-run-wait.js';

export type TicketRun = {
  readonly availability: RunAvailability;
  readonly activeRun?: {
    readonly id: string;
    readonly startedAt: string;
    readonly steps: ReadonlyArray<RunStep>;
    readonly waitingFor?: TicketRunWait;
    readonly waitingSince?: string;
  };
  readonly lastRun?: {
    readonly id: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly ending: RunEnding;
  };
};
