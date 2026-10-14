import type { NeedsYouResponse } from '@aisf/app/api-schemas/needs-you-schemas.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

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
    if (!isRequestFailure(error)) throw error;
    const message = error.message;
    return { kind: 'request-failed', detail: `${requestLabel} · ${message}` };
  }
}
