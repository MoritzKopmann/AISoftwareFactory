import type { PageStatus } from './page-status.js';

export type ListedArtifact = {
  readonly artifactId: string;
  readonly title: string;
  readonly token: string;
  readonly status: PageStatus;
};
