import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';

export type TicketRunOutcome =
  | { readonly kind: 'answer'; readonly response: TicketRunResponse }
  | { readonly kind: 'request-failed' };

export async function fetchTicketRun(
  projectId: string,
  number: number,
  request: (url: string) => Promise<Response>,
): Promise<TicketRunOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/tickets/${number}/run`);
    if (!response.ok) {
      return { kind: 'request-failed' };
    }
    return { kind: 'answer', response: (await response.json()) as TicketRunResponse };
  } catch {
    return { kind: 'request-failed' };
  }
}
