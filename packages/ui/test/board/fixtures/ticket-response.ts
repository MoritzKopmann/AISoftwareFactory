import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

type ClosingPullRequestResponse = TicketResponse['closingPullRequests'][number];

export function buildClosingPullRequestResponse(
  overrides: Pick<ClosingPullRequestResponse, 'number' | 'url' | 'state'>,
): ClosingPullRequestResponse {
  return {
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
