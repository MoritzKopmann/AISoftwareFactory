import type { FindingResponse, FindingsResponse } from '@aisf/app/api-schemas/findings-schemas.js';

export type FindingsOutcome =
  | { readonly kind: 'answer'; readonly findings: ReadonlyArray<FindingResponse> }
  | { readonly kind: 'not-ok'; readonly status: number }
  | { readonly kind: 'unreachable'; readonly message: string };

export async function fetchFindings(
  projectId: string,
  request: (url: string) => Promise<Response>,
  ticketNumber?: number,
): Promise<FindingsOutcome> {
  try {
    const ticketFilter = ticketNumber === undefined ? '' : `?ticket=${ticketNumber}`;
    const response = await request(`/api/projects/${projectId}/findings${ticketFilter}`);
    if (!response.ok) {
      return { kind: 'not-ok', status: response.status };
    }
    const body = (await response.json()) as FindingsResponse;
    return { kind: 'answer', findings: body.findings };
  } catch (error) {
    return { kind: 'unreachable', message: error instanceof Error ? error.message : String(error) };
  }
}
