import type { TicketPageOutcome } from './describe-ticket-page.js';

/** A later failed read keeps a shown answer; before any answer, a failure is shown. */
export function outcomeAfterRefresh(
  shown: TicketPageOutcome,
  refreshed: TicketPageOutcome,
): TicketPageOutcome {
  return refreshed.kind === 'answered' || shown.kind !== 'answered' ? refreshed : shown;
}
