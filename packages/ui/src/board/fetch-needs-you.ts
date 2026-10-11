import type { NeedsYouResponse } from '@aisf/app/api-schemas/needs-you-schemas.js';

export type NeedsYouOutcome =
  | { readonly kind: 'answer'; readonly response: NeedsYouResponse }
  | { readonly kind: 'request-failed' };

export async function fetchNeedsYou(
  projectId: string,
  request: (url: string) => Promise<Response>,
): Promise<NeedsYouOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/needs-you`);
    if (!response.ok) {
      return { kind: 'request-failed' };
    }
    return { kind: 'answer', response: (await response.json()) as NeedsYouResponse };
  } catch {
    return { kind: 'request-failed' };
  }
}
