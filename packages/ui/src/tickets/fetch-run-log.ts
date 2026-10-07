import type { RunLogResponse } from '@aisf/app/api-schemas/run-log-schemas.js';

export type RunLogOutcome =
  | { readonly kind: 'answer'; readonly response: RunLogResponse }
  | { readonly kind: 'answered-error'; readonly status: number }
  | { readonly kind: 'request-failed'; readonly message: string };

export async function fetchRunLog(
  projectId: string,
  number: number,
  request: (url: string) => Promise<Response>,
): Promise<RunLogOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/tickets/${number}/run-log`);
    if (!response.ok) {
      return { kind: 'answered-error', status: response.status };
    }
    return { kind: 'answer', response: (await response.json()) as RunLogResponse };
  } catch (error) {
    return {
      kind: 'request-failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
