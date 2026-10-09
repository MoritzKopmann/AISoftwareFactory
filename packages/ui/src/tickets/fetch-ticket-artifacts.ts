import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';

export type TicketArtifactsFailure =
  | { readonly kind: 'not-ok'; readonly status: number }
  | { readonly kind: 'network'; readonly message: string };

export type TicketArtifactsOutcome =
  | { readonly kind: 'answer'; readonly response: TicketArtifactsResponse }
  | { readonly kind: 'request-failed'; readonly cause: TicketArtifactsFailure };

export async function fetchTicketArtifacts(
  projectId: string,
  number: number,
  request: (url: string) => Promise<Response>,
): Promise<TicketArtifactsOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/tickets/${number}/artifacts`);
    if (!response.ok) {
      return { kind: 'request-failed', cause: { kind: 'not-ok', status: response.status } };
    }
    return { kind: 'answer', response: (await response.json()) as TicketArtifactsResponse };
  } catch (error) {
    return {
      kind: 'request-failed',
      cause: { kind: 'network', message: error instanceof Error ? error.message : String(error) },
    };
  }
}
