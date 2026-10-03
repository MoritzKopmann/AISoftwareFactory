import { describe, expect, it } from 'vitest';
import { ticketResponseSchema } from '../../../../../src/modules/watcher/api/schemas/tickets-schemas.js';
import { buildTicket } from '../../fakes/build-ticket.js';

const closingPullRequest = {
  number: 5,
  url: 'https://github.com/owner/name/pull/5',
  state: 'OPEN',
  checks: 'passing',
  mergeable: 'mergeable',
  canBeRebased: true,
  headCommit: 'a',
};

describe('ticketResponseSchema', () => {
  it('should parse when the ticket status is waiting', () => {
    const ticket = buildTicket({ number: 1, status: 'waiting' });

    expect(ticketResponseSchema.safeParse(ticket).success).toBe(true);
  });

  it('should carry the approval as a boolean when the closing pull request has approved', () => {
    const ticket = {
      ...buildTicket({ number: 1 }),
      closingPullRequests: [{ ...closingPullRequest, approved: true }],
    };

    expect(ticketResponseSchema.parse(ticket).closingPullRequests[0]?.approved).toBe(true);
  });

  it('should fail to parse when the ticket has no body', () => {
    const ticket: Record<string, unknown> = { ...buildTicket({ number: 1 }) };
    delete ticket['body'];

    expect(ticketResponseSchema.safeParse(ticket).success).toBe(false);
  });

  it('should fail to parse when the closing pull request carries reviewDecision in place of approved', () => {
    const ticket = {
      ...buildTicket({ number: 1 }),
      closingPullRequests: [{ ...closingPullRequest, reviewDecision: 'APPROVED' }],
    };

    expect(ticketResponseSchema.safeParse(ticket).success).toBe(false);
  });
});
