import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { RunStage } from '../types/run-stage.js';

/** The start prompt of a run. A rework run is also told when the ticket's last run ended. */
export function buildStartPrompt(input: {
  readonly stage: RunStage;
  readonly skill: string;
  readonly status: TicketStatus;
  readonly ticketNumber: number;
  readonly latestRunEndedAt: string | undefined;
}): string {
  const command = `/${input.skill} ${input.ticketNumber}`;
  const isRework = input.stage === 'implement' && input.status === 'in-review';
  return isRework && input.latestRunEndedAt !== undefined
    ? `${command} --since ${input.latestRunEndedAt}`
    : command;
}
