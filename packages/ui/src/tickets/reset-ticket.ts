import { readErrorMessage } from '../shared/read-error-message.js';

export type ResetTicketOutcome =
  | { readonly kind: 'reset' }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export async function resetTicket(
  projectId: string,
  number: number,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<ResetTicketOutcome> {
  let response: Response;
  try {
    response = await request(`/api/projects/${projectId}/tickets/${number}/reset`, {
      method: 'POST',
    });
  } catch {
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    return { kind: 'reset' };
  }
  return { kind: 'failed', message: await readErrorMessage(response), status: response.status };
}
