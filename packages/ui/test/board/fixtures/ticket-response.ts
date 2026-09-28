import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type ClosingPullRequestResponse = TicketResponse['closingPullRequests'][number];

export function buildClosingPullRequestResponse(
  overrides: Partial<ClosingPullRequestResponse> & Pick<ClosingPullRequestResponse, 'number'>,
): ClosingPullRequestResponse {
  return {
    url: `https://github.com/o/n/pull/${overrides.number}`,
    state: 'OPEN',
    reviewDecision: 'none',
    checks: 'none',
    mergeable: 'unknown',
    canBeRebased: false,
    headCommit: 'abc123',
    ...overrides,
  };
}

export function buildTicketResponse(overrides: Partial<TicketResponse> = {}): TicketResponse {
  return {
    number: 1,
    title: 'A ticket',
    url: 'https://github.com/o/n/issues/1',
    status: 'ready',
    conflictingStatuses: [],
    hitl: false,
    subIssueNumbers: [],
    blockedBy: [],
    closingPullRequests: [],
    updatedAt: '2026-09-28T10:00:00Z',
    ...overrides,
  };
}
