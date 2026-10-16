import type { RunEndingResponse, TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describeTimeAgo } from '../board/describe-time-ago.js';
import { formatClockTime } from '../board/format-clock-time.js';
import { isIdeaOrPlanSkill, type RunSkill } from './describe-run-bar.js';
import { countRunMinutes } from './count-run-minutes.js';
import { describeStopAction, type StopActionDescription } from './describe-stop-action.js';
import type { TicketRunPoll } from './fold-ticket-run-poll.js';

type ActiveRun = NonNullable<TicketRunResponse['activeRun']>;
type LastRun = NonNullable<TicketRunResponse['lastRun']>;

export type RunPanelInput = TicketRunPoll & {
  readonly ticketStuck: boolean;
  readonly stopping: boolean;
  readonly runSkill: RunSkill;
};

function describeStartedLabel(startedAt: string, runSkill: RunSkill, now: Date): string {
  const timeAgo = describeTimeAgo(startedAt, now);
  return isIdeaOrPlanSkill(runSkill) ? `${runSkill} · started ${timeAgo}` : `Started ${timeAgo}`;
}

type LiveRunDescription = {
  readonly kind: 'live';
  readonly waiting: boolean;
  readonly startedLabel: string;
  readonly stop: StopActionDescription;
  readonly banner?: string;
};

type EndedRunDescription = {
  readonly kind: 'ended';
  readonly endedLabel: string;
  readonly note: string;
};

export type RunPanelDescription =
  { readonly kind: 'hidden' } | LiveRunDescription | EndedRunDescription;

function describeLiveRun(
  activeRun: ActiveRun,
  input: RunPanelInput,
  now: Date,
): LiveRunDescription {
  return {
    kind: 'live',
    waiting: activeRun.waitingFor !== undefined,
    startedLabel: describeStartedLabel(activeRun.startedAt, input.runSkill, now),
    stop: describeStopAction(input.stopping),
    ...(input.lastPollFailed && input.answeredAt !== undefined
      ? {
          banner: `Can't reach aisf. Showing the run from ${formatClockTime(input.answeredAt, 'minutes')}. Loads again on the next change, or on Retry.`,
        }
      : {}),
  };
}

function endingNote(ending: RunEndingResponse): string | undefined {
  switch (ending.kind) {
    case 'permission-needed':
    case 'checkpoint':
      return undefined;
    case 'stopped':
      return 'Run ended: you pressed Stop. The worktree and branch are left as they are.';
    case 'crashed':
      return `Run ended: the session crashed. ${ending.reason}`;
    case 'usage-limit':
      return 'Run ended: the usage limit was reached.';
    case 'app-restarted':
      return 'Run ended: aisf restarted during the run.';
    case 'escalated':
      return `Run ended: ${ending.reason}`;
    case 'finished':
      return 'Run ended: the session finished without completing the ticket.';
    case 'parked':
      return `Run ended: parked until #${ending.blockerNumber} is done.`;
  }
}

function describeRunLength(lastRun: LastRun): string {
  const ranMinutes = countRunMinutes(lastRun);
  return ranMinutes < 1 ? 'ran under 1 min' : `ran ${ranMinutes} min`;
}

export function describeRunPanel(input: RunPanelInput, now: Date): RunPanelDescription {
  const activeRun = input.response?.activeRun;
  if (activeRun !== undefined) {
    return describeLiveRun(activeRun, input, now);
  }
  const lastRun = input.response?.lastRun;
  if (lastRun === undefined || !input.ticketStuck) {
    return { kind: 'hidden' };
  }
  const note = endingNote(lastRun.ending);
  if (note === undefined) {
    return { kind: 'hidden' };
  }
  return {
    kind: 'ended',
    endedLabel: `Ended ${formatClockTime(lastRun.endedAt, 'minutes')} · ${describeRunLength(lastRun)}`,
    note,
  };
}
