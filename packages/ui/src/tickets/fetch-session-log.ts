import type { SessionLogResponse } from '@aisf/app/api-schemas/runs-schemas.js';

export type SessionLogOutcome =
  | { readonly kind: 'answer'; readonly response: SessionLogResponse }
  | { readonly kind: 'answered-error'; readonly status: number }
  | { readonly kind: 'request-failed'; readonly message: string };

export async function fetchSessionLog(
  projectId: string,
  number: number,
  request: (url: string) => Promise<Response>,
): Promise<SessionLogOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/tickets/${number}/session-log`);
    if (!response.ok) {
      return { kind: 'answered-error', status: response.status };
    }
    return { kind: 'answer', response: (await response.json()) as SessionLogResponse };
  } catch (error) {
    return {
      kind: 'request-failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
