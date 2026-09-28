import { describe, expect, it } from 'vitest';
import { describeTicketCard } from '../../src/board/describe-ticket-card.js';
import {
  buildClosingPullRequestResponse,
  buildTicketResponse,
} from './fixtures/ticket-response.js';

describe('describeTicketCard', () => {
  it('should describe the link, number, title and flags when the ticket is plain', () => {
    const card = describeTicketCard(buildTicketResponse({ number: 12, title: 'Plain' }), 'o/n');
    expect(card).toEqual({
      href: '#/projects/o/n/tickets/12',
      numberLabel: '#12',
      title: 'Plain',
      hitl: false,
      blockerLabels: [],
      conflictLabels: [],
      pullRequestChips: [],
    });
  });

  it('should include the parent title and hitl flag when the ticket has them', () => {
    const card = describeTicketCard(
      buildTicketResponse({ hitl: true, parent: { number: 3, title: 'Epic' } }),
      'o/n',
    );
    expect(card.parentTitle).toBe('Epic');
    expect(card.hitl).toBe(true);
  });

  it('should list only open blockers, qualified when in another repository', () => {
    const card = describeTicketCard(
      buildTicketResponse({
        blockedBy: [
          { repository: 'o/n', number: 1, open: false },
          { repository: 'O/N', number: 2, open: true },
          { repository: 'x/y', number: 3, open: true },
        ],
      }),
      'o/n',
    );
    expect(card.blockerLabels).toEqual(['blocked by #2', 'blocked by x/y#3']);
  });

  it('should show conflicting statuses as lowercase names', () => {
    const card = describeTicketCard(
      buildTicketResponse({
        status: 'conflict',
        conflictingStatuses: ['plan', 'in-progress', 'in-review'],
      }),
      'o/n',
    );
    expect(card.conflictLabels).toEqual(['plan', 'in progress', 'in review']);
  });

  it('should make one chip per closing pull request', () => {
    const card = describeTicketCard(
      buildTicketResponse({
        closingPullRequests: [buildClosingPullRequestResponse({ number: 7 })],
      }),
      'o/n',
    );
    expect(card.pullRequestChips).toEqual([{ label: 'PR #7' }]);
  });
});
