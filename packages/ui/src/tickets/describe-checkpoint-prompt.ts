import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { AnswerCheckpointOutcome } from './answer-checkpoint.js';
import { checkpointAnswerCharacterLimit } from './checkpoint-answer-character-limit.js';

type FailedSend = Extract<AnswerCheckpointOutcome, { kind: 'failed' }>;

export type CheckpointSend = { readonly kind: 'idle' } | { readonly kind: 'sending' } | FailedSend;

export type CheckpointAnswer = {
  readonly runId: string;
  readonly draft: string;
  readonly send: CheckpointSend;
};

type CheckpointPromptError = { readonly message: string; readonly detail?: string };

export type CheckpointPromptDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly runId: string;
      readonly request: string;
      readonly draft: string;
      readonly counterText: string;
      readonly hint: string;
      readonly atLimit: boolean;
      readonly sending: boolean;
      readonly pressable: boolean;
      readonly reason?: string;
      readonly announcement?: string;
      readonly error?: CheckpointPromptError;
    };

function describeFailedSend(send: FailedSend): CheckpointPromptError {
  return {
    message: `Couldn't send your answer. ${send.message}`.trimEnd(),
    ...(send.status === undefined ? {} : { detail: String(send.status) }),
  };
}

function groupThousands(count: number): string {
  return String(count).replace(/\B(?=(\d{3})+$)/g, ' ');
}

function describeHeldSend(ticketStatus: TicketStatusResponse, draft: string): string | undefined {
  if (ticketStatus !== 'waiting') {
    return 'Waiting for GitHub to show the ticket as waiting. Send unlocks then, usually within 30 s.';
  }
  if (draft.trim() === '') {
    return 'Write an answer to send it.';
  }
  return undefined;
}

export function describeCheckpointPrompt(
  response: TicketRunResponse | undefined,
  ticketStatus: TicketStatusResponse,
  answer: CheckpointAnswer | undefined,
): CheckpointPromptDescription {
  const lastRun = response?.lastRun;
  if (
    response?.activeRun !== undefined ||
    lastRun === undefined ||
    lastRun.ending.kind !== 'checkpoint'
  ) {
    return { kind: 'hidden' };
  }
  const runAnswer = answer?.runId === lastRun.id ? answer : undefined;
  const draft = runAnswer?.draft ?? '';
  const atLimit = draft.length >= checkpointAnswerCharacterLimit;
  const limitText = groupThousands(checkpointAnswerCharacterLimit);
  const prompt = {
    kind: 'shown',
    runId: lastRun.id,
    request: lastRun.ending.request,
    draft,
    counterText: `${groupThousands(draft.length)} / ${limitText}`,
    hint: atLimit
      ? 'Limit reached. Shorten the answer to add more.'
      : `Plain text. Up to ${limitText} characters.`,
    atLimit,
  } as const;
  const send = runAnswer?.send;
  if (send?.kind === 'sending') {
    return { ...prompt, sending: true, pressable: false, announcement: 'Sending your answer' };
  }
  const reason = describeHeldSend(ticketStatus, draft);
  return {
    ...prompt,
    sending: false,
    pressable: reason === undefined,
    ...(reason === undefined ? {} : { reason }),
    ...(send?.kind === 'failed' ? { error: describeFailedSend(send) } : {}),
  };
}
