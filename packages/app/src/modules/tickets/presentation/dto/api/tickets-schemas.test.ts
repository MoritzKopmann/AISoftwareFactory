import { describe, expect, it } from 'vitest';
import { ticketResponseSchema, type TicketResponse } from './tickets-schemas.js';

function buildTicket(
  overrides: Partial<TicketResponse> & Pick<TicketResponse, 'number'>,
): TicketResponse {
  return {
    title: `Ticket ${overrides.number}`,
    url: `https://github.com/owner/name/issues/${overrides.number}`,
    body: '',
    status: 'idea',
    conflictingStatuses: [],
    hitl: false,
    waiting: false,
    stuck: false,
    types: [],
    subIssueNumbers: [],
    blockedBy: [],
    closingPullRequests: [],
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

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
  it('should carry the waiting and stuck flags when the ticket has them', () => {
    const ticket = buildTicket({ number: 1, status: 'in-progress', waiting: true });

    expect(ticketResponseSchema.parse(ticket)).toMatchObject({
      status: 'in-progress',
      waiting: true,
      stuck: false,
    });
  });

  it.each(['waiting', 'stuck'])('should reject %s as a status', (status) => {
    const ticket = { ...buildTicket({ number: 1 }), status };

    expect(ticketResponseSchema.safeParse(ticket).success).toBe(false);
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
