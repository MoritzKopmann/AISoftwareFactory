import type { ProjectBoardResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { BoardOutcome } from './fold-board-outcome.js';

export async function fetchBoardOutcome(
  projectId: string,
  request: (url: string) => Promise<Response>,
): Promise<BoardOutcome> {
  try {
    const response = await request(`/api/projects/${projectId}/board`);
    if (response.status === 404) {
      return { kind: 'not-watched' };
    }
    if (!response.ok) {
      return { kind: 'request-failed' };
    }
    return { kind: 'answer', response: (await response.json()) as ProjectBoardResponse };
  } catch {
    return { kind: 'request-failed' };
  }
}
