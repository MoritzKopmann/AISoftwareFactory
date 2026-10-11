import type { RunEndTransition } from '../types/run-end-transition.js';
import type { RunEnding } from '../types/run-ending.js';
import type { RunStage } from '../types/run-stage.js';
import type { TicketLiveState } from '../types/ticket-live-state.js';
import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

const runningStatuses: Readonly<Record<RunStage, ReadonlyArray<TicketStatus>>> = {
  implement: ['ready', 'in-progress'],
  spike: ['ready', 'in-progress'],
  create: ['idea'],
  plan: ['plan'],
};

export function decideRunEndTransition(
  ending: RunEnding,
  live: TicketLiveState,
  stage: RunStage,
): RunEndTransition {
  const authoring = stage === 'create' || stage === 'plan';
  if (ending.kind === 'parked') {
    return !authoring && live.status === 'in-progress'
      ? { kind: 'return-to-ready' }
      : { kind: 'none' };
  }
  if (!runningStatuses[stage].includes(live.status) || live.stuck) {
    return { kind: 'none' };
  }
  // An authoring run that ends `finished` is normal: the ticket moved on by itself.
  if (authoring && ending.kind === 'finished') {
    return { kind: 'none' };
  }
  if (ending.kind === 'checkpoint' || ending.kind === 'permission-needed') {
    if (live.waiting) {
      return { kind: 'none' };
    }
    return { kind: 'flag', state: 'waiting', comment: describeEnding(ending) };
  }
  return { kind: 'flag', state: 'stuck', comment: describeEnding(ending) };
}

function describeEnding(ending: Exclude<RunEnding, { kind: 'parked' }>): string {
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
    case 'usage-limit':
      return `The run hit the usage limit: ${ending.reason}`;
    case 'app-restarted':
      return 'The app restarted during the run';
  }
}
