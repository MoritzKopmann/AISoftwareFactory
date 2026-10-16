export type PublishRequest = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly runId: string;
  readonly worktreePath: string;
  readonly artifactId: string;
  readonly title: string;
};
