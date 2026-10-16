export type MergeablePullRequest = {
  readonly ticketNumber: number;
  readonly pullRequestNumber: number;
  readonly headCommit: string;
};
