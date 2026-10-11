import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { isResettable, type ResettableTicketState } from './is-resettable.js';
import type { StartRunOutcome } from './start-ticket-run.js';

export type StartState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | Extract<StartRunOutcome, { kind: 'failed' }>;

export type RunSkill = 'spike' | 'implement-ticket' | 'create-ticket' | 'plan-ticket';

type RunBarError = { readonly message: string; readonly detail?: string };

export type RunBarDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly button: 'run' | 'disabled' | 'starting';
      readonly pressable: boolean;
      readonly label?: string;
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

// A start that succeeded stays `starting` until the poll shows its run. Once it has, it is done.
export function settleStartState(
  start: StartState,
  response: TicketRunResponse | undefined,
): StartState {
  return start.kind === 'starting' && response?.activeRun !== undefined ? { kind: 'idle' } : start;
}

export function describeRunBar(
  response: TicketRunResponse | undefined,
  ticketState: ResettableTicketState,
  start: StartState,
  number: number,
  runSkill: RunSkill,
): RunBarDescription {
  if (response === undefined || response.activeRun !== undefined) {
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
      return ticketState.status === 'in-progress' &&
        !ticketState.stuck &&
        isResettable(response, ticketState)
        ? {
            kind: 'shown',
            button: 'disabled',
            pressable: false,
            reason: 'Ticket is in progress, but no run is active on it.',
          }
        : { kind: 'hidden' };
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
        ...(runSkill === 'create-ticket' || runSkill === 'plan-ticket'
          ? { label: `Run ${runSkill}` }
          : {}),
        ...(start.kind === 'failed'
          ? describeError(start)
          : { hint: `Runs ${runSkill} on #${number} in its own worktree.` }),
      };
  }
}
