import type {
  IdeaResponse,
  IdeaRunNotStartedResponse,
} from '@aisf/app/api-schemas/ideas-schemas.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

export type StartIdeaOutcome =
  | { readonly kind: 'started'; readonly ticketNumber: number }
  | { readonly kind: 'failed'; readonly message: string; readonly ticketNumber?: number };

export async function startIdeaSession(
  projectId: string,
  text: string,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<StartIdeaOutcome> {
  let response: Response;
  try {
    response = await request(`/api/projects/${projectId}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    const started = (await response.json()) as IdeaResponse;
    return { kind: 'started', ticketNumber: started.ticketNumber };
  }
  const body = (await response.json().catch((error: unknown) => {
    if (!(error instanceof SyntaxError)) throw error;
    return {};
  })) as Partial<IdeaRunNotStartedResponse>;
  return {
    kind: 'failed',
    message: typeof body.message === 'string' ? body.message : '',
    ...(typeof body.ticketNumber === 'number' ? { ticketNumber: body.ticketNumber } : {}),
  };
}
