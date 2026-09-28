import type { RunEndTransition } from '../types/run-end-transition.js';
import type { RunEnding } from '../types/run-ending.js';
import type { TicketStatus } from '../types/ticket-status.js';

const runningStatuses: ReadonlyArray<TicketStatus> = ['ready', 'in-progress'];

export function decideRunEndTransition(
  ending: RunEnding,
  liveStatus: TicketStatus,
): RunEndTransition {
  if (ending.kind === 'parked') {
    return liveStatus === 'in-progress'
      ? { kind: 'transition', allowedFrom: ['in-progress'], to: 'ready' }
      : { kind: 'none' };
  }
  if (!runningStatuses.includes(liveStatus)) {
    return { kind: 'none' };
  }
  return {
    kind: 'transition',
    allowedFrom: runningStatuses,
    to: 'stuck',
    comment: describeEnding(ending),
  };
}

function describeEnding(ending: Exclude<RunEnding, { kind: 'parked' }>): string {
  switch (ending.kind) {
    case 'escalated':
      return `The run escalated (${ending.escalation}): ${ending.reason}`;
    case 'permission-needed':
      return `The run needs permission for ${ending.toolName} with input ${JSON.stringify(ending.toolInput)}`;
    case 'finished':
      return 'The run finished without opening a pull request';
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
