import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import type { TicketPageOutcome } from '../../src/tickets/describe-ticket-page.js';
import { outcomeAfterRefresh } from '../../src/tickets/outcome-after-refresh.js';
import { buildTicketResponse } from '../board/fixtures/ticket-response.js';

function answered(ticket: TicketResponse): TicketPageOutcome {
  return {
    kind: 'answered',
    response: { projectId: 'o/n', sync: { state: 'pending' }, ticket },
  };
}

describe('outcomeAfterRefresh', () => {
  const loaded = answered(buildTicketResponse({ status: 'in-progress' }));

  it('should take the new answer when the refresh answered', () => {
    const refreshed = answered(buildTicketResponse({ status: 'stuck' }));
    expect(outcomeAfterRefresh(loaded, refreshed)).toBe(refreshed);
  });

  it('should keep the shown ticket when the refresh failed', () => {
    expect(outcomeAfterRefresh(loaded, { kind: 'request-failed', message: 'offline' })).toBe(
      loaded,
    );
    expect(outcomeAfterRefresh(loaded, { kind: 'not-found' })).toBe(loaded);
  });
});
