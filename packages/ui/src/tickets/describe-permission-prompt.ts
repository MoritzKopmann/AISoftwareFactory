import type {
  PermissionAnswerRequest,
  TicketRunResponse,
} from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

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
  | {
      readonly kind: 'failed';
      readonly wait: PermissionWait;
      readonly message: string;
      readonly status?: number;
    };

type PermissionPromptError = { readonly message: string; readonly detail?: string };

export type PermissionPromptDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly runId: string;
      readonly waitingSince?: string;
      readonly toolName: string;
      readonly inputText: string;
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
        };
  }
  const lastRun = response?.lastRun;
  return lastRun?.ending.kind === 'permission-needed'
    ? { runId: lastRun.id, toolName: lastRun.ending.toolName, toolInput: lastRun.ending.toolInput }
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
  ticketStatus: TicketStatusResponse,
  answer: PermissionAnswer,
): PermissionPromptDescription {
  const wait = findShownWait(response);
  if (wait === undefined || ticketStatus !== 'waiting') {
    return { kind: 'hidden' };
  }
  const { toolName, toolInput } = wait;
  const prompt = {
    kind: 'shown',
    runId: wait.runId,
    ...(wait.waitingSince === undefined ? {} : { waitingSince: wait.waitingSince }),
    toolName,
    inputText: describeToolInput(toolName, toolInput),
  } as const;
  if (answer.kind === 'idle' || !isSameWait(answer.wait, wait)) {
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
