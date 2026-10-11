import type { NeedsYouResponse } from '@aisf/app/api-schemas/needs-you-schemas.js';

export type NeedsYouOutcome =
  | { readonly kind: 'answer'; readonly response: NeedsYouResponse }
  | { readonly kind: 'request-failed'; readonly detail: string };

const requestLabel = 'GET /needs-you';

export async function fetchNeedsYou(
  projectId: string,
  request: (url: string) => Promise<Response>,
): Promise<NeedsYouOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/needs-you`);
    if (!response.ok) {
      const status = `${response.status} ${response.statusText}`.trim();
      return { kind: 'request-failed', detail: `${requestLabel} · ${status}` };
    }
    return { kind: 'answer', response: (await response.json()) as NeedsYouResponse };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: 'request-failed', detail: `${requestLabel} · ${message}` };
  }
}
