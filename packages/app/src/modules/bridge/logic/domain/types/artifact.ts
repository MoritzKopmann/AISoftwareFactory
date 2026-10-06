export type Artifact = {
  readonly token: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly artifactId: string;
  readonly title: string;
  readonly directory: string;
  readonly runId: string;
  readonly version: number;
  readonly publishedAt: string;
};
