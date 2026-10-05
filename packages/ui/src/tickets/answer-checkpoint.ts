import type { CheckpointAnswerRequest } from '@aisf/app/api-schemas/runs-schemas.js';
import { readErrorMessage } from '../shared/read-error-message.js';

export type AnswerCheckpointOutcome =
  | { readonly kind: 'answered' }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export async function answerCheckpoint(
  runId: string,
  answer: string,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<AnswerCheckpointOutcome> {
  let response: Response;
  try {
    response = await request(`/api/runs/${runId}/checkpoint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer } satisfies CheckpointAnswerRequest),
    });
  } catch {
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    return { kind: 'answered' };
  }
  return { kind: 'failed', message: await readErrorMessage(response), status: response.status };
}
