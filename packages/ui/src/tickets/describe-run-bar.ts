import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { StartRunOutcome } from './start-ticket-run.js';

export type StartState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | Extract<StartRunOutcome, { kind: 'failed' }>;

type RunBarError = { readonly message: string; readonly detail?: string };

export type RunBarDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly button: 'run' | 'disabled' | 'starting';
      readonly pressable: boolean;
      readonly hint?: string;
      readonly reason?: string;
      readonly announcement?: string;
      readonly error?: RunBarError;
    };

function describeError(start: StartState): { readonly error?: RunBarError } {
  if (start.kind !== 'failed') {
    return {};
  }
  return {
    error: {
      message: `Couldn't start the run. ${start.message}`.trimEnd(),
      ...(start.status === undefined ? {} : { detail: String(start.status) }),
    },
  };
}

export function describeRunBar(
  response: TicketRunResponse | undefined,
  start: StartState,
  number: number,
): RunBarDescription {
  if (
    response === undefined ||
    response.activeRun !== undefined ||
    response.lastRun !== undefined
  ) {
    return { kind: 'hidden' };
  }
  if (start.kind === 'starting') {
    return {
      kind: 'shown',
      button: 'starting',
      pressable: false,
      announcement: 'Starting the run',
    };
  }
  const { availability } = response;
  switch (availability.kind) {
    case 'absent':
      return { kind: 'hidden' };
    case 'disabled':
      return {
        kind: 'shown',
        button: 'disabled',
        pressable: false,
        reason: availability.reason,
        ...describeError(start),
      };
    case 'available':
      return {
        kind: 'shown',
        button: 'run',
        pressable: true,
        ...(start.kind === 'failed'
          ? describeError(start)
          : { hint: `Runs implement-ticket on #${number} in its own worktree.` }),
      };
  }
}
