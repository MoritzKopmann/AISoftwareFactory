import { readErrorMessage } from '../shared/read-error-message.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

export type StartRunOutcome =
  | { readonly kind: 'started' }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export async function startTicketRun(
  projectId: string,
  number: number,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<StartRunOutcome> {
  let response: Response;
  try {
    response = await request(`/api/projects/${projectId}/tickets/${number}/runs`, {
      method: 'POST',
    });
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    return { kind: 'started' };
  }
  return { kind: 'failed', message: await readErrorMessage(response), status: response.status };
}
