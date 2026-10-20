import type { IdeaResponse } from '@aisf/app/api-schemas/ideas-schemas.js';
import type { ErrorResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

const HTTP_CONFLICT_STATUS = 409;

export type StartOnboardingOutcome =
  | { readonly kind: 'started'; readonly ticketNumber: number }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'failed'; readonly message: string };

export async function startOnboarding(
  projectId: string,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<StartOnboardingOutcome> {
  let response: Response;
  try {
    response = await request(`/api/projects/${projectId}/onboarding`, { method: 'POST' });
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    const started = (await response.json()) as Pick<IdeaResponse, 'ticketNumber'>;
    return { kind: 'started', ticketNumber: started.ticketNumber };
  }
  if (response.status === HTTP_CONFLICT_STATUS) {
    return { kind: 'conflict' };
  }
  const body = (await response.json().catch((error: unknown) => {
    if (!(error instanceof SyntaxError)) throw error;
    return {};
  })) as Partial<ErrorResponse>;
  return { kind: 'failed', message: typeof body.message === 'string' ? body.message : '' };
}
