import { describe, expect, it } from 'vitest';
import type { TicketPageOutcome } from '../../src/tickets/describe-ticket-page.js';
import { ticketLiveView } from '../../src/tickets/ticket-live-view.js';
import { buildTicketResponse } from '../board/fixtures/ticket-response.js';

function answered(status: 'closed' | 'ready'): TicketPageOutcome {
  return {
    kind: 'answered',
    response: {
      projectId: 'octo/repo',
      sync: { state: 'pending' },
      ticket: buildTicketResponse({ status }),
    },
  };
}

describe('ticketLiveView', () => {
  it('should be closed when the last answer shows the ticket closed', () => {
    expect(ticketLiveView('octo/repo', 7, answered('closed'))).toEqual({
      kind: 'ticket',
      projectId: 'octo/repo',
      ticketNumber: 7,
      closed: true,
    });
  });

  it('should be open when the last answer shows another status or there is none', () => {
    expect(ticketLiveView('octo/repo', 7, answered('ready')).closed).toBe(false);
    expect(ticketLiveView('octo/repo', 7, { kind: 'loading' }).closed).toBe(false);
  });
});
