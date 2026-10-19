import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { AnswerCheckpointOutcome } from './answer-checkpoint.js';
import { checkpointAnswerCharacterLimit } from './checkpoint-answer-character-limit.js';
import { waitingPage } from './waiting-page.js';
import { formatResetTime } from '../usage/format-reset-time.js';

type FailedSend = Extract<AnswerCheckpointOutcome, { kind: 'failed' }>;

export type CheckpointSend =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'held'; readonly pausedUntil: string }
  | FailedSend;

export type CheckpointAnswer = {
  readonly runId: string;
  readonly draft: string;
  readonly send: CheckpointSend;
};

type CheckpointPromptError = { readonly message: string; readonly detail?: string };

export type CheckpointPromptDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'held';
      readonly runId: string;
      readonly request: string;
      readonly heldUntilLabel?: string;
    }
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

function describeHeldSend(ticketWaiting: boolean, draft: string): string | undefined {
  if (!ticketWaiting) {
    return 'Waiting for GitHub to show the ticket as waiting. Send unlocks then, usually within 30 s.';
  }
  if (draft.trim() === '') {
    return 'Write an answer to send it.';
  }
  return undefined;
}

type ShownWait = { readonly runId: string; readonly request: string; readonly answerHeld: boolean };

function findShownWait(response: TicketRunResponse | undefined): ShownWait | undefined {
  // A wait with a page is answered in the round panel, not here.
  if (waitingPage(response) !== undefined) {
    return undefined;
  }
  const activeRun = response?.activeRun;
  if (activeRun !== undefined) {
    return activeRun.waitingFor?.kind !== 'checkpoint'
      ? undefined
      : {
          runId: activeRun.id,
          request: activeRun.waitingFor.request,
          answerHeld: activeRun.answerHeld,
        };
  }
  const lastRun = response?.lastRun;
  return lastRun?.ending.kind === 'checkpoint'
    ? { runId: lastRun.id, request: lastRun.ending.request, answerHeld: lastRun.answerHeld }
    : undefined;
}

// An answer belongs to one wait. Once the poll shows its run past that wait, the answer is stale.
export function settleCheckpointAnswer(
  answer: CheckpointAnswer | undefined,
  response: TicketRunResponse | undefined,
): CheckpointAnswer | undefined {
  if (answer === undefined || response === undefined) return answer;
  const wait = findShownWait(response);
  if (wait?.runId !== answer.runId) return undefined;
  // A held answer lives while its run holds it. Once the hold has ended, the answer went out.
  const holdEnded = answer.send.kind === 'held' && !wait.answerHeld;
  return holdEnded ? undefined : answer;
}

export function describeCheckpointPrompt(
  response: TicketRunResponse | undefined,
  ticketWaiting: boolean,
  answer: CheckpointAnswer | undefined,
  pausedUntil?: string,
  now: Date = new Date(),
): CheckpointPromptDescription {
  const wait = findShownWait(response);
  if (wait === undefined) {
    return { kind: 'hidden' };
  }
  const runAnswer = answer?.runId === wait.runId ? answer : undefined;
  const send = runAnswer?.send;
  if (isAnswerHeld(wait, send)) {
    // The usage reset time wins; the held answer's own time is the fallback.
    const heldUntil = pausedUntil ?? (send?.kind === 'held' ? send.pausedUntil : undefined);
    return describeHeldPrompt(wait, heldUntil, now);
  }
  const draft = runAnswer?.draft ?? '';
  const atLimit = draft.length >= checkpointAnswerCharacterLimit;
  const limitText = groupThousands(checkpointAnswerCharacterLimit);
  const prompt = {
    kind: 'shown',
    runId: wait.runId,
    request: wait.request,
    draft,
    counterText: `${groupThousands(draft.length)} / ${limitText}`,
    hint: atLimit
      ? 'Limit reached. Shorten the answer to add more.'
      : `Plain text. Up to ${limitText} characters.`,
    atLimit,
  } as const;
  if (send?.kind === 'sending') {
    return { ...prompt, sending: true, pressable: false, announcement: 'Sending your answer' };
  }
  const reason = describeHeldSend(ticketWaiting, draft);
  return {
    ...prompt,
    sending: false,
    pressable: reason === undefined,
    ...(reason === undefined ? {} : { reason }),
    ...(send?.kind === 'failed' ? { error: describeFailedSend(send) } : {}),
  };
}

function isAnswerHeld(wait: ShownWait, send: CheckpointSend | undefined): boolean {
  return wait.answerHeld || send?.kind === 'held';
}

function describeHeldPrompt(
  wait: ShownWait,
  heldUntil: string | undefined,
  now: Date,
): CheckpointPromptDescription {
  return {
    kind: 'held',
    runId: wait.runId,
    request: wait.request,
    ...(heldUntil === undefined ? {} : { heldUntilLabel: formatResetTime(heldUntil, now) }),
  };
}
