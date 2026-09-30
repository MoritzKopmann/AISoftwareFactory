import type {
  PermissionAnswerRequest,
  TicketRunResponse,
} from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type PermissionDecision = PermissionAnswerRequest['decision'];

export type PermissionAnswer =
  | { readonly kind: 'idle' }
  | { readonly kind: 'answering'; readonly runId: string; readonly decision: PermissionDecision }
  | {
      readonly kind: 'failed';
      readonly runId: string;
      readonly message: string;
      readonly status?: number;
    };

type PermissionPromptError = { readonly message: string; readonly detail?: string };

export type PermissionPromptDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly runId: string;
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

export function describePermissionPrompt(
  response: TicketRunResponse | undefined,
  ticketStatus: TicketStatusResponse,
  answer: PermissionAnswer,
): PermissionPromptDescription {
  const lastRun = response?.lastRun;
  if (
    response?.activeRun !== undefined ||
    lastRun === undefined ||
    lastRun.ending.kind !== 'permission-needed' ||
    ticketStatus !== 'stuck'
  ) {
    return { kind: 'hidden' };
  }
  const { toolName, toolInput } = lastRun.ending;
  const prompt = {
    kind: 'shown',
    runId: lastRun.id,
    toolName,
    inputText: describeToolInput(toolName, toolInput),
  } as const;
  if (answer.kind === 'idle' || answer.runId !== lastRun.id) {
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
