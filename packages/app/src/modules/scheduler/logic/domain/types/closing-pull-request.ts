export type ClosingPullRequest = {
  readonly number: number;
  readonly state: string;
  readonly approved: boolean;
  readonly checks: 'passing' | 'failing' | 'pending' | 'none';
  readonly mergeable: 'mergeable' | 'conflicting' | 'unknown';
  readonly canBeRebased: boolean;
  readonly headCommit: string;
};
