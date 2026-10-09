import type { LiveView } from '../live/notice-concerns-view.js';
import type { TicketPageOutcome } from './describe-ticket-page.js';

type TicketLiveView = Extract<LiveView, { kind: 'ticket' }>;

/** The ticket page is closed once its last answer shows the ticket closed. */
export function ticketLiveView(
  projectId: string,
  ticketNumber: number,
  outcome: TicketPageOutcome,
): TicketLiveView {
  return {
    kind: 'ticket',
    projectId,
    ticketNumber,
    closed: outcome.kind === 'answered' && outcome.response.ticket?.status === 'closed',
  };
}
