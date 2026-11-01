import type { HeldAnswerResponse, SendMessageBody } from '@aisf/app/api-schemas/runs-schemas.js';
import { readErrorMessage } from '../shared/read-error-message.js';
import { isRequestFailure } from '../shared/is-request-failure.js';
import { heldAnswerStatus } from './held-answer-status.js';

export type SendMessageOutcome =
  | { readonly kind: 'sent' }
  | { readonly kind: 'held'; readonly pausedUntil: string }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export async function sendMessage(
  runId: string,
  text: string,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<SendMessageOutcome> {
  let response: Response;
  try {
    response = await request(`/api/runs/${runId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text } satisfies SendMessageBody),
    });
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.status === heldAnswerStatus) {
    const heldResponse = (await response.json()) as HeldAnswerResponse;
    return { kind: 'held', pausedUntil: heldResponse.pausedUntil };
  }
  if (response.ok) {
    return { kind: 'sent' };
  }
  return { kind: 'failed', message: await readErrorMessage(response), status: response.status };
}
