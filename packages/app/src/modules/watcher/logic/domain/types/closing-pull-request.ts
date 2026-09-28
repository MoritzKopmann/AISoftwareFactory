export type ClosingPullRequest = {
  readonly number: number;
  readonly url: string;
  readonly state: string;
  readonly reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | 'none';
  readonly checks: 'passing' | 'failing' | 'pending' | 'none';
  readonly mergeable: 'mergeable' | 'conflicting' | 'unknown';
  readonly canBeRebased: boolean;
  readonly headCommit: string;
};
