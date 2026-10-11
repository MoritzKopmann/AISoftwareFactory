import { describe, expect, it } from 'vitest';
import { describeReviewPanel } from '../../src/tickets/describe-review-panel.js';
import {
  type ClosingPullRequestResponse,
  buildClosingPullRequestResponse,
  buildTicketResponse,
} from '../board/fixtures/ticket-response.js';

function describeOnePullRequest(overrides: Partial<ClosingPullRequestResponse>) {
  const description = describeReviewPanel(
    buildTicketResponse({
      status: 'in-review',
      closingPullRequests: [buildClosingPullRequestResponse({ number: 426, ...overrides })],
    }),
  );
  if (description.kind !== 'shown') throw new Error('expected the panel to show');
  return description;
}

function chipTexts(overrides: Partial<ClosingPullRequestResponse>) {
  return describeOnePullRequest(overrides).pullRequests[0]?.chips.map((chip) => chip.text);
}

describe('describeReviewPanel', () => {
  it('should describe an open panel with open, approved, passing and conflict-free chips when the PR is open and all good', () => {
    const ticket = buildTicketResponse({
      status: 'in-review',
      closingPullRequests: [
        buildClosingPullRequestResponse({
          number: 426,
          state: 'OPEN',
          approved: true,
          checks: 'passing',
          mergeable: 'mergeable',
        }),
      ],
    });
    expect(describeReviewPanel(ticket)).toEqual({
      kind: 'shown',
      state: 'open',
      heading: { tone: 'hitl', glyph: '●', text: 'Review the PR' },
      pullRequests: [
        {
          label: 'PR #426',
          url: 'https://github.com/o/n/pull/426',
          chips: [
            { tone: 'flow', glyph: '●', text: 'Open' },
            { tone: 'done', glyph: '✓', text: 'Approved' },
            { tone: 'done', glyph: '✓', text: 'Checks pass' },
            { tone: 'done', glyph: '✓', text: 'No conflicts' },
          ],
        },
      ],
    });
  });

  it('should describe neutral, danger and warn chips when the open PR is not approved, fails checks and conflicts', () => {
    expect(
      describeOnePullRequest({
        state: 'OPEN',
        approved: false,
        checks: 'failing',
        mergeable: 'conflicting',
      }).pullRequests[0]?.chips,
    ).toEqual([
      { tone: 'flow', glyph: '●', text: 'Open' },
      { tone: 'neutral', glyph: '○', text: 'Not approved' },
      { tone: 'danger', glyph: '■', text: 'Checks fail' },
      { tone: 'warn', glyph: '▲', text: 'Conflicts' },
    ]);
  });

  it('should describe a merged panel without a conflicts chip when every PR is merged', () => {
    const description = describeOnePullRequest({
      state: 'MERGED',
      approved: true,
      checks: 'passing',
      mergeable: 'mergeable',
    });
    expect(description.state).toBe('merged');
    expect(description.heading).toEqual({ tone: 'done', glyph: '✓', text: 'Merged' });
    expect(description.pullRequests[0]?.chips).toEqual([
      { tone: 'done', glyph: '✓', text: 'Merged' },
      { tone: 'done', glyph: '✓', text: 'Approved' },
      { tone: 'done', glyph: '✓', text: 'Checks pass' },
    ]);
  });

  it('should describe a neutral checks pending chip when checks are pending', () => {
    expect(describeOnePullRequest({ checks: 'pending' }).pullRequests[0]?.chips).toContainEqual({
      tone: 'neutral',
      glyph: '○',
      text: 'Checks pending',
    });
  });

  it('should describe no checks chip when the PR has no checks', () => {
    expect(chipTexts({ checks: 'none', mergeable: 'mergeable' })).toEqual([
      'Open',
      'Not approved',
      'No conflicts',
    ]);
  });

  it('should describe no conflicts chip when mergeability is unknown', () => {
    expect(chipTexts({ approved: true, checks: 'pending', mergeable: 'unknown' })).toEqual([
      'Open',
      'Approved',
      'Checks pending',
    ]);
  });

  it('should describe a neutral closed chip and no conflicts chip when the PR is closed', () => {
    expect(
      describeOnePullRequest({ state: 'CLOSED', approved: true, mergeable: 'conflicting' })
        .pullRequests[0]?.chips,
    ).toEqual([
      { tone: 'neutral', glyph: '○', text: 'Closed' },
      { tone: 'done', glyph: '✓', text: 'Approved' },
    ]);
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
