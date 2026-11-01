import { formatResetTime } from '../usage/format-reset-time.js';
import type { SendMessageOutcome } from './send-message.js';
import type { MessageFieldProps } from './message-field.js';

type FailedSend = Extract<SendMessageOutcome, { kind: 'failed' }>;

export type MessageSend =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'held'; readonly pausedUntil: string }
  | FailedSend;

export type MessageDraft = {
  readonly runId: string;
  readonly draft: string;
  readonly send: MessageSend;
};

export type MessageFieldDescription = Pick<
  MessageFieldProps,
  'draft' | 'pressable' | 'sending' | 'noActiveRun' | 'error' | 'held'
>;

export function describeMessageField(
  activeRunId: string | undefined,
  message: MessageDraft | undefined,
  now: Date,
): MessageFieldDescription {
  if (activeRunId === undefined) {
    return { draft: '', pressable: false, sending: false, noActiveRun: true };
  }
  const own = message?.runId === activeRunId ? message : undefined;
  const draft = own?.draft ?? '';
  const send = own?.send;
  const sending = send?.kind === 'sending';
  return {
    draft,
    pressable: !sending && draft.trim() !== '',
    sending,
    noActiveRun: false,
    ...(send?.kind === 'failed'
      ? {
          error: {
            message: send.message,
            ...(send.status === undefined ? {} : { status: String(send.status) }),
          },
        }
      : {}),
    ...(send?.kind === 'held'
      ? { held: { heldUntilLabel: formatResetTime(send.pausedUntil, now) } }
      : {}),
  };
}

export function editMessageDraft(runId: string, draft: string): MessageDraft {
  return { runId, draft, send: { kind: 'idle' } };
}
