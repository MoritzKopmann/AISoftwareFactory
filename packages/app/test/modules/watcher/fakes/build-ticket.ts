import type { Ticket } from '../../../../src/modules/watcher/logic/domain/types/ticket.js';

export function buildTicket(overrides: Partial<Ticket> & Pick<Ticket, 'number'>): Ticket {
  return {
    title: `Ticket ${overrides.number}`,
    url: `https://github.com/owner/name/issues/${overrides.number}`,
    body: '',
    status: 'idea',
    conflictingStatuses: [],
    hitl: false,
    subIssueNumbers: [],
    blockedBy: [],
    closingPullRequests: [],
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}
