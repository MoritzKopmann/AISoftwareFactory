import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';

export type ArtifactLink = {
  readonly artifactId: string;
  readonly label: string;
  readonly url: string;
};

export function describeArtifactLinks(
  response: TicketArtifactsResponse | undefined,
): ReadonlyArray<ArtifactLink> {
  return (response?.artifacts ?? [])
    .filter((artifact) => artifact.status === 'open')
    .map((artifact) => ({
      artifactId: artifact.artifactId,
      label: `Open page: ${artifact.title}`,
      url: artifact.url,
    }));
}
