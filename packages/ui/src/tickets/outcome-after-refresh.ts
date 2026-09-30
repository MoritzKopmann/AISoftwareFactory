import type { TicketPageOutcome } from './describe-ticket-page.js';

export function outcomeAfterRefresh(
  shown: TicketPageOutcome,
  refreshed: TicketPageOutcome,
): TicketPageOutcome {
  return refreshed.kind === 'answered' ? refreshed : shown;
}
