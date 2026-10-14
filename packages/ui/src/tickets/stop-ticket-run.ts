import { isRequestFailure } from '../shared/is-request-failure.js';

export type StopRunOutcome = { readonly kind: 'requested' } | { readonly kind: 'failed' };

const runAlreadyEndedStatus = 409;

export async function stopTicketRun(
  runId: string,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<StopRunOutcome> {
  try {
    const response = await request(`/api/runs/${runId}/stop`, { method: 'POST' });
    if (response.ok || response.status === runAlreadyEndedStatus) {
      return { kind: 'requested' };
    }
    return { kind: 'failed' };
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed' };
  }
}
