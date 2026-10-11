import { describe, expect, it } from 'vitest';
import { describeReviewPanel } from '../../src/tickets/describe-review-panel.js';
import {
  buildClosingPullRequestResponse,
  buildTicketResponse,
} from '../board/fixtures/ticket-response.js';

describe('describeReviewPanel', () => {
  it('should show the PR link and state when the ticket is in review', () => {
    const ticket = buildTicketResponse({
      status: 'in-review',
      closingPullRequests: [
        buildClosingPullRequestResponse({
          number: 5,
          url: 'https://github.com/o/n/pull/5',
          state: 'OPEN',
          approved: true,
          checks: 'passing',
        }),
      ],
    });
    const description = describeReviewPanel(ticket);
    expect(description.kind).toBe('shown');
    if (description.kind !== 'shown') return;
    expect(description.pullRequests[0]).toMatchObject({
      label: 'PR #5',
      url: 'https://github.com/o/n/pull/5',
      state: 'open',
    });
    expect(JSON.stringify(description)).not.toMatch(/merge"/i);
  });

  it('should be hidden when the ticket is not in review', () => {
    const ticket = buildTicketResponse({
      status: 'ready',
      closingPullRequests: [buildClosingPullRequestResponse({ number: 5 })],
    });
    expect(describeReviewPanel(ticket)).toEqual({ kind: 'hidden' });
  });

  it('should be hidden when the ticket is in review without a PR', () => {
    expect(describeReviewPanel(buildTicketResponse({ status: 'in-review' }))).toEqual({
      kind: 'hidden',
    });
  });
});
