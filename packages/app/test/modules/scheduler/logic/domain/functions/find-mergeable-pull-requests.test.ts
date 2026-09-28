import { describe, expect, it } from 'vitest';
import { findMergeablePullRequests } from '../../../../../../src/modules/scheduler/logic/domain/functions/find-mergeable-pull-requests.js';
import type { ClosingPullRequest } from '../../../../../../src/modules/scheduler/logic/domain/types/closing-pull-request.js';
import type { ReviewedTicket } from '../../../../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';

const mergeablePullRequest: ClosingPullRequest = {
  number: 201,
  state: 'OPEN',
  reviewDecision: 'APPROVED',
  checks: 'passing',
  mergeable: 'mergeable',
  canBeRebased: true,
  headCommit: 'abc123',
};

function inReviewTicket(...closingPullRequests: ClosingPullRequest[]): ReviewedTicket {
  return { number: 140, status: 'in-review', closingPullRequests };
}

describe('findMergeablePullRequests', () => {
  it('should select the pull request pinned to its head commit when it is approved, passing, mergeable and rebaseable', () => {
    expect(findMergeablePullRequests([inReviewTicket(mergeablePullRequest)], [])).toEqual([
      { ticketNumber: 140, pullRequestNumber: 201, headCommit: 'abc123' },
    ]);
  });

  it('should select the pull request when it has no checks', () => {
    const noChecks: ClosingPullRequest = { ...mergeablePullRequest, checks: 'none' };

    expect(findMergeablePullRequests([inReviewTicket(noChecks)], [])).toHaveLength(1);
  });

  it.each<[string, Partial<ClosingPullRequest>]>([
    ['checks are failing', { checks: 'failing' }],
    ['checks are pending', { checks: 'pending' }],
    ['it conflicts', { mergeable: 'conflicting' }],
    ['its mergeability is unknown', { mergeable: 'unknown' }],
    ['it cannot be rebased', { canBeRebased: false }],
    ['a review requested changes', { reviewDecision: 'CHANGES_REQUESTED' }],
    ['it awaits review', { reviewDecision: 'REVIEW_REQUIRED' }],
    ['it has no review decision', { reviewDecision: 'none' }],
    ['it is already merged', { state: 'MERGED' }],
  ])('should select nothing when %s', (_reason, override) => {
    const pullRequest: ClosingPullRequest = { ...mergeablePullRequest, ...override };

    expect(findMergeablePullRequests([inReviewTicket(pullRequest)], [])).toEqual([]);
  });

  it('should select nothing when the ticket is not in-review', () => {
    const inProgress: ReviewedTicket = {
      ...inReviewTicket(mergeablePullRequest),
      status: 'in-progress',
    };

    expect(findMergeablePullRequests([inProgress], [])).toEqual([]);
  });

  it('should select nothing when the ticket has an active run', () => {
    expect(
      findMergeablePullRequests([inReviewTicket(mergeablePullRequest)], [{ ticketNumber: 140 }]),
    ).toEqual([]);
  });

  it('should select nothing when the ticket has more than one open closing pull request', () => {
    const second: ClosingPullRequest = { ...mergeablePullRequest, number: 202 };

    expect(findMergeablePullRequests([inReviewTicket(mergeablePullRequest, second)], [])).toEqual(
      [],
    );
  });

  it('should ignore a closed pull request when one open pull request is mergeable', () => {
    const abandoned: ClosingPullRequest = { ...mergeablePullRequest, number: 199, state: 'CLOSED' };

    expect(
      findMergeablePullRequests([inReviewTicket(abandoned, mergeablePullRequest)], []),
    ).toEqual([{ ticketNumber: 140, pullRequestNumber: 201, headCommit: 'abc123' }]);
  });
});
