import type { FindingResponse } from '@aisf/app/api-schemas/findings-schemas.js';
import type { FindingsFailure } from './fold-findings-poll.js';

export type CreateTicketOutcome =
  { readonly kind: 'created'; readonly ticketNumber: number } | FindingsFailure;

export async function createTicketFromFinding(
  projectId: string,
  findingId: number,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<CreateTicketOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/findings/${findingId}/ticket`, {
      method: 'POST',
    });
    if (!response.ok) {
      return { kind: 'not-ok', status: response.status };
    }
    const finding = (await response.json()) as FindingResponse;
    if (finding.createdTicketNumber === undefined) {
      return { kind: 'unreachable', message: 'The answer names no ticket.' };
    }
    return { kind: 'created', ticketNumber: finding.createdTicketNumber };
  } catch (error) {
    return { kind: 'unreachable', message: error instanceof Error ? error.message : String(error) };
  }
}
