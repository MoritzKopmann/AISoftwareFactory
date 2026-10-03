import type { RunsBlocked } from './runs-blocked.js';
import type { SchedulableTicket } from './schedulable-ticket.js';

export type RunAvailabilityInput = {
  readonly ticket?: SchedulableTicket;
  readonly ticketIsRunning: boolean;
  readonly runsBlocked: RunsBlocked;
  readonly projectOnboarded: boolean;
  readonly lastRunEndedAt?: string;
};
