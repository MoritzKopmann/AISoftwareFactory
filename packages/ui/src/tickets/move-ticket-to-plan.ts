import { readErrorMessage } from '../shared/read-error-message.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

export type MoveTicketToPlanOutcome =
  | { readonly kind: 'moved' }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export async function moveTicketToPlan(
  projectId: string,
  number: number,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<MoveTicketToPlanOutcome> {
  let response: Response;
  try {
    response = await request(`/api/projects/${projectId}/tickets/${number}/move-to-plan`, {
      method: 'POST',
    });
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    return { kind: 'moved' };
  }
  return { kind: 'failed', message: await readErrorMessage(response), status: response.status };
}
