import type {
  PermissionAnswerRequest,
  TicketRunResponse,
} from '@aisf/app/api-schemas/runs-schemas.js';
import { formatResetTime } from '../usage/format-reset-time.js';

export type PermissionDecision = PermissionAnswerRequest['decision'];

// A live wait is told apart by its start time. The fallback wait has none: one per run.
export type PermissionWait = { readonly runId: string; readonly waitingSince?: string };

export type PermissionAnswer =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'answering';
      readonly wait: PermissionWait;
      readonly decision: PermissionDecision;
    }
  | { readonly kind: 'held'; readonly wait: PermissionWait; readonly pausedUntil: string }
  | {
      readonly kind: 'failed';
      readonly wait: PermissionWait;
      readonly message: string;
      readonly status?: number;
    };

type PermissionPromptError = { readonly message: string; readonly detail?: string };

type HeldAnswer = Extract<PermissionAnswer, { kind: 'held' }>;

export type PermissionPromptDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'held';
      readonly runId: string;
      readonly toolName: string;
      readonly inputText: string;
      readonly heldUntilLabel?: string;
    }
  | {
      readonly kind: 'shown';
      readonly runId: string;
      readonly waitingSince?: string;
      readonly toolName: string;
      readonly inputText: string;
      readonly reason?: string;
      readonly guidance: boolean;
      readonly pressable: boolean;
      readonly resuming?: PermissionDecision;
      readonly announcement?: string;
      readonly error?: PermissionPromptError;
    };

function describeToolInput(toolName: string, toolInput: Readonly<Record<string, unknown>>): string {
  const { command } = toolInput;
  if (toolName === 'Bash' && typeof command === 'string') {
    return command;
  }
  return JSON.stringify(toolInput, undefined, 2);
}

type ShownWait = PermissionWait & {
  readonly toolName: string;
  readonly toolInput: Readonly<Record<string, unknown>>;
  readonly reason?: string;
  readonly answerHeld: boolean;
};

function findShownWait(response: TicketRunResponse | undefined): ShownWait | undefined {
  const activeRun = response?.activeRun;
  if (activeRun !== undefined) {
    const { waitingFor } = activeRun;
    return waitingFor?.kind !== 'permission-needed'
      ? undefined
      : {
          runId: activeRun.id,
          ...(activeRun.waitingSince === undefined ? {} : { waitingSince: activeRun.waitingSince }),
          toolName: waitingFor.toolName,
          toolInput: waitingFor.toolInput,
          ...(waitingFor.reason === undefined ? {} : { reason: waitingFor.reason }),
          answerHeld: activeRun.answerHeld,
        };
  }
  const lastRun = response?.lastRun;
  return lastRun?.ending.kind === 'permission-needed'
    ? {
        runId: lastRun.id,
        toolName: lastRun.ending.toolName,
        toolInput: lastRun.ending.toolInput,
        ...(lastRun.ending.reason === undefined ? {} : { reason: lastRun.ending.reason }),
        answerHeld: lastRun.answerHeld,
      }
    : undefined;
}

function isSameWait(left: PermissionWait, right: PermissionWait): boolean {
  return left.runId === right.runId && left.waitingSince === right.waitingSince;
}

// An answer belongs to one wait. Once the poll shows a different wait or none, it is stale.
export function settlePermissionAnswer(
  answer: PermissionAnswer,
  response: TicketRunResponse | undefined,
): PermissionAnswer {
  if (answer.kind === 'idle' || response === undefined) return answer;
  const wait = findShownWait(response);
  return wait !== undefined && isSameWait(wait, answer.wait) ? answer : { kind: 'idle' };
}

export function describePermissionPrompt(
  response: TicketRunResponse | undefined,
  ticketWaiting: boolean,
  answer: PermissionAnswer,
  pausedUntil?: string,
  now: Date = new Date(),
): PermissionPromptDescription {
  const wait = findShownWait(response);
  if (wait === undefined) {
    return { kind: 'hidden' };
  }
  const heldAnswer = heldAnswerFor(answer, wait);
  // A held answer stays on screen after the app drops the waiting label.
  if (isAnswerHeld(wait, heldAnswer)) {
    // The usage reset time wins; the held answer's own time is the fallback.
    return describeHeldPrompt(wait, pausedUntil ?? heldAnswer?.pausedUntil, now);
  }
  if (!ticketWaiting) {
    return { kind: 'hidden' };
  }
  const { toolName, toolInput } = wait;
  const prompt = {
    kind: 'shown',
    runId: wait.runId,
    ...(wait.waitingSince === undefined ? {} : { waitingSince: wait.waitingSince }),
    toolName,
    inputText: describeToolInput(toolName, toolInput),
    ...(wait.reason === undefined ? {} : { reason: wait.reason }),
  } as const;
  if (answer.kind === 'idle' || answer.kind === 'held' || !isSameWait(answer.wait, wait)) {
    return { ...prompt, guidance: true, pressable: true };
  }
  if (answer.kind === 'answering') {
    return {
      ...prompt,
      guidance: false,
      pressable: false,
      resuming: answer.decision,
      announcement: 'Resuming the run',
    };
  }
  return {
    ...prompt,
    guidance: false,
    pressable: true,
    error: {
      message: `Couldn't send your answer. ${answer.message}`.trimEnd(),
      ...(answer.status === undefined ? {} : { detail: String(answer.status) }),
    },
  };
}

function heldAnswerFor(answer: PermissionAnswer, wait: ShownWait): HeldAnswer | undefined {
  return answer.kind === 'held' && isSameWait(answer.wait, wait) ? answer : undefined;
}

function isAnswerHeld(wait: ShownWait, heldAnswer: HeldAnswer | undefined): boolean {
  return wait.answerHeld || heldAnswer !== undefined;
}

function describeHeldPrompt(
  wait: ShownWait,
  heldUntil: string | undefined,
  now: Date,
): PermissionPromptDescription {
  return {
    kind: 'held',
    runId: wait.runId,
    toolName: wait.toolName,
    inputText: describeToolInput(wait.toolName, wait.toolInput),
    ...(heldUntil === undefined ? {} : { heldUntilLabel: formatResetTime(heldUntil, now) }),
  };
}
