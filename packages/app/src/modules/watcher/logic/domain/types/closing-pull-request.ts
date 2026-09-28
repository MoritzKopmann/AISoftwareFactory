export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | 'none';
export type ChecksState = 'passing' | 'failing' | 'pending' | 'none';
export type Mergeability = 'mergeable' | 'conflicting' | 'unknown';

export type ClosingPullRequest = {
  readonly number: number;
  readonly url: string;
  readonly state: string;
  readonly reviewDecision: ReviewDecision;
  readonly checks: ChecksState;
  readonly mergeable: Mergeability;
  readonly canBeRebased: boolean;
  readonly headCommit: string;
};
