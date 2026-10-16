import type { ListedArtifact } from '../../../business/domain/types/listed-artifact.js';
import type { PageState } from '../../../business/domain/types/page-state.js';
import type { TicketArtifactsResponse, PageStatusResponse } from '../api/artifacts-schemas.js';

export function toTicketArtifactsResponse(
  artifacts: ReadonlyArray<ListedArtifact>,
): TicketArtifactsResponse {
  return {
    artifacts: artifacts.map(({ artifactId, title, token, status }) => ({
      artifactId,
      title,
      url: `/a/${token}/`,
      status,
    })),
  };
}

export function toPageStatusResponse({ status, version }: PageState): PageStatusResponse {
  return { status, version };
}
