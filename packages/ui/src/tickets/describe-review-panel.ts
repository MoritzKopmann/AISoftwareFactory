import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { StatusMarkTone } from '../board/describe-ticket-status-mark.js';

type ClosingPullRequest = TicketResponse['closingPullRequests'][number];

type ReviewChip = {
  readonly tone: Exclude<StatusMarkTone, 'hitl'>;
  readonly glyph: string;
  readonly text: string;
};

type ReviewPullRequest = {
  readonly label: string;
  readonly url: string;
  readonly chips: ReadonlyArray<ReviewChip>;
};

export type ReviewPanelDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly state: 'open' | 'merged';
      readonly heading: {
        readonly tone: 'hitl' | 'done';
        readonly glyph: string;
        readonly text: string;
      };
      readonly pullRequests: ReadonlyArray<ReviewPullRequest>;
    };

export function describeReviewPanel(
  ticket: Pick<TicketResponse, 'status' | 'closingPullRequests'>,
): ReviewPanelDescription {
  if (ticket.status !== 'in-review' || ticket.closingPullRequests.length === 0) {
    return { kind: 'hidden' };
  }
  const everyMerged = ticket.closingPullRequests.every(isMerged);
  return {
    kind: 'shown',
    state: everyMerged ? 'merged' : 'open',
    heading: everyMerged
      ? { tone: 'done', glyph: '✓', text: 'Merged' }
      : { tone: 'hitl', glyph: '●', text: 'Review the PR' },
    pullRequests: ticket.closingPullRequests.map((pullRequest) => ({
      label: `PR #${pullRequest.number}`,
      url: pullRequest.url,
      chips: describeChips(pullRequest),
    })),
  };
}

const checksChips: Readonly<Record<ClosingPullRequest['checks'], ReviewChip | undefined>> = {
  passing: { tone: 'done', glyph: '✓', text: 'Checks pass' },
  failing: { tone: 'danger', glyph: '■', text: 'Checks fail' },
  pending: { tone: 'neutral', glyph: '○', text: 'Checks pending' },
  none: undefined,
};

const conflictsChips: Readonly<Record<ClosingPullRequest['mergeable'], ReviewChip | undefined>> = {
  mergeable: { tone: 'done', glyph: '✓', text: 'No conflicts' },
  conflicting: { tone: 'warn', glyph: '▲', text: 'Conflicts' },
  unknown: undefined,
};

function isMerged(pullRequest: ClosingPullRequest): boolean {
  return pullRequest.state === 'MERGED';
}

function isOpen(pullRequest: ClosingPullRequest): boolean {
  return pullRequest.state === 'OPEN';
}

function describeChips(pullRequest: ClosingPullRequest): ReadonlyArray<ReviewChip> {
  const stateChip: ReviewChip = isMerged(pullRequest)
    ? { tone: 'done', glyph: '✓', text: 'Merged' }
    : isOpen(pullRequest)
      ? { tone: 'flow', glyph: '●', text: 'Open' }
      : { tone: 'neutral', glyph: '○', text: 'Closed' };
  const approvalChip: ReviewChip = pullRequest.approved
    ? { tone: 'done', glyph: '✓', text: 'Approved' }
    : { tone: 'neutral', glyph: '○', text: 'Not approved' };
  const checksChip = checksChips[pullRequest.checks];
  const conflictsChip = isOpen(pullRequest) ? conflictsChips[pullRequest.mergeable] : undefined;
  return [stateChip, approvalChip, checksChip, conflictsChip].filter(
    (chip): chip is ReviewChip => chip !== undefined,
  );
}
