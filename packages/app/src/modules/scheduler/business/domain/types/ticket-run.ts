import type { RunAvailability } from './run-availability.js';
import type { RunEnding } from './run-ending.js';
import type { RunWait } from './run-wait.js';

export type TicketRun = {
  readonly availability: RunAvailability;
  readonly activeRun?: {
    readonly id: string;
    readonly startedAt: string;
    readonly answerHeld: boolean;
    readonly waitingFor?: RunWait;
    readonly waitingSince?: string;
  };
  readonly lastRun?: {
    readonly id: string;
    readonly startedAt: string;
    readonly answerHeld: boolean;
    readonly endedAt: string;
    readonly ending: RunEnding;
  };
};
