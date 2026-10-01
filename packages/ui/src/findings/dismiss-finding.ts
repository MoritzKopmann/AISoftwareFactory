import type { FindingsFailure } from './fold-findings-poll.js';

export type DismissOutcome = { readonly kind: 'dismissed' } | FindingsFailure;

export async function dismissFinding(
  projectId: string,
  findingId: number,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<DismissOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/findings/${findingId}/dismiss`, {
      method: 'POST',
    });
    if (!response.ok) {
      return { kind: 'not-ok', status: response.status };
    }
    return { kind: 'dismissed' };
  } catch (error) {
    return { kind: 'unreachable', message: error instanceof Error ? error.message : String(error) };
  }
}
