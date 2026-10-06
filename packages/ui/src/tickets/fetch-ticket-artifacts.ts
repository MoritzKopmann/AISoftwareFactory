import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';

export type TicketArtifactsOutcome =
  | { readonly kind: 'answer'; readonly response: TicketArtifactsResponse }
  | { readonly kind: 'request-failed' };

export async function fetchTicketArtifacts(
  projectId: string,
  number: number,
  request: (url: string) => Promise<Response>,
): Promise<TicketArtifactsOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/tickets/${number}/artifacts`);
    if (!response.ok) {
      return { kind: 'request-failed' };
    }
    return { kind: 'answer', response: (await response.json()) as TicketArtifactsResponse };
  } catch {
    return { kind: 'request-failed' };
  }
}
