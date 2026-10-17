import type { RunsBlocked } from './runs-blocked.js';
import type { SchedulableTicket } from './schedulable-ticket.js';

export type RunAvailabilityInput = {
  readonly ticket?: SchedulableTicket;
  readonly subIssues: ReadonlyArray<SchedulableTicket>;
  readonly ticketIsRunning: boolean;
  readonly runsBlocked: RunsBlocked;
  readonly projectOnboarded: boolean;
  readonly trigger: 'manual' | 'auto';
  readonly projectPaused: boolean;
  readonly lastRunEndedAt?: string;
};
