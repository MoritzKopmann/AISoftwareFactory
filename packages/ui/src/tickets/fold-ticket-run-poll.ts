import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketRunOutcome } from './fetch-ticket-run.js';

export type TicketRunPoll = {
  readonly response?: TicketRunResponse;
  readonly answeredAt?: string;
  readonly lastPollFailed: boolean;
};

export const initialTicketRunPoll: TicketRunPoll = { lastPollFailed: false };

export function foldTicketRunPoll(
  poll: TicketRunPoll,
  outcome: TicketRunOutcome,
  now: string,
): TicketRunPoll {
  if (outcome.kind === 'request-failed') {
    return { ...poll, lastPollFailed: true };
  }
  return { response: outcome.response, answeredAt: now, lastPollFailed: false };
}
