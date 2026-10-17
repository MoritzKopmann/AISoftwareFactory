import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { readErrorMessage } from '../shared/read-error-message.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

export type SetProjectPausedOutcome =
  | { readonly kind: 'saved'; readonly project: ProjectResponse }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export async function setProjectPaused(
  projectId: string,
  paused: boolean,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<SetProjectPausedOutcome> {
  let response: Response;
  try {
    response = await request(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused }),
    });
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    return { kind: 'saved', project: (await response.json()) as ProjectResponse };
  }
  return { kind: 'failed', message: await readErrorMessage(response), status: response.status };
}
