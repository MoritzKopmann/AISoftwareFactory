import type { RunWait } from './run-wait.js';

export type ActiveTicketRun = {
  readonly run: {
    readonly id: string;
    readonly ticketNumber: number;
    readonly startedAt: string;
    readonly waitingFor?: RunWait;
    readonly waitingSince?: string;
  };
};
