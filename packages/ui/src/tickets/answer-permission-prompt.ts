import { readErrorMessage } from '../shared/read-error-message.js';
import type { PermissionDecision } from './describe-permission-prompt.js';

export type AnswerPermissionOutcome =
  | { readonly kind: 'answered' }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export async function answerPermissionPrompt(
  runId: string,
  decision: PermissionDecision,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<AnswerPermissionOutcome> {
  let response: Response;
  try {
    response = await request(`/api/runs/${runId}/permission`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
  } catch {
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    return { kind: 'answered' };
  }
  return { kind: 'failed', message: await readErrorMessage(response), status: response.status };
}
