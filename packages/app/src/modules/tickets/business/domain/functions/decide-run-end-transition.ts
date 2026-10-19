import type { RunEndTransition } from '../types/run-end-transition.js';
import type { RunEnding } from '../types/run-ending.js';
import type { RunStage } from '../types/run-stage.js';
import type { TicketLiveState } from '../types/ticket-live-state.js';
import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

const runningStatuses: Readonly<Record<RunStage, ReadonlyArray<TicketStatus>>> = {
  implement: ['ready', 'in-progress', 'in-review'],
  spike: ['ready', 'in-progress'],
  create: ['idea'],
  plan: ['plan'],
};

export function needsSpikeCheck(
  ending: RunEnding,
  live: TicketLiveState,
  stage: RunStage,
): boolean {
  return stage === 'plan' && ending.kind === 'finished' && live.status === 'plan' && !live.stuck;
}

export function decideRunEndTransition(
  ending: RunEnding,
  live: TicketLiveState,
  stage: RunStage,
  hasOpenSpike = true,
): RunEndTransition {
  // A usage-limit run pauses and continues at the reset: the ticket stays as it is.
  if (ending.kind === 'usage-limit') {
    return { kind: 'none' };
  }
  const authoring = stage === 'create' || stage === 'plan';
  if (ending.kind === 'parked') {
    return !authoring && live.status === 'in-progress'
      ? { kind: 'return-to-ready' }
      : { kind: 'none' };
  }
  if (!runningStatuses[stage].includes(live.status) || live.stuck) {
    return { kind: 'none' };
  }
  if (isFinishedRework(ending, live, stage)) {
    return { kind: 'none' };
  }
  // An authoring run that ends `finished` is normal: the ticket moved on by itself.
  // A plan run left at `plan` with no open spike would be started again every poll.
  if (authoring && ending.kind === 'finished') {
    return needsSpikeCheck(ending, live, stage) && !hasOpenSpike
      ? {
          kind: 'flag',
          state: 'stuck',
          comment: 'The plan run finished but the ticket is still at plan',
        }
      : { kind: 'none' };
  }
  if (ending.kind === 'checkpoint' || ending.kind === 'permission-needed') {
    if (live.waiting) {
      return { kind: 'none' };
    }
    return { kind: 'flag', state: 'waiting', comment: describeEnding(ending) };
  }
  return { kind: 'flag', state: 'stuck', comment: describeEnding(ending) };
}

// A rework run that finishes has completed, or found nothing to do.
function isFinishedRework(ending: RunEnding, live: TicketLiveState, stage: RunStage): boolean {
  return stage === 'implement' && live.status === 'in-review' && ending.kind === 'finished';
}

function describeEnding(ending: Exclude<RunEnding, { kind: 'parked' | 'usage-limit' }>): string {
  switch (ending.kind) {
    case 'checkpoint':
      return `The run reached its human checkpoint and waits for an answer on the ticket page:\n\n${ending.request}`;
    case 'permission-needed':
      return `The run needs permission for ${ending.toolName} with input ${JSON.stringify(ending.toolInput)}${ending.reason === undefined ? '' : `\n\nReason: ${ending.reason}`}`;
    case 'escalated':
      return `The run escalated (${ending.escalation}): ${ending.reason}`;
    case 'finished':
      return 'The run finished without completing the ticket';
    case 'stopped':
      return 'The run was stopped';
    case 'crashed':
      return `The run crashed: ${ending.reason}`;
    case 'app-restarted':
      return 'The app restarted during the run';
  }
}
