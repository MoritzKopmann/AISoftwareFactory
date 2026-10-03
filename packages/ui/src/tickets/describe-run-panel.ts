import type { RunEndingResponse, TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describeTimeAgo } from '../board/describe-time-ago.js';
import { formatClockTime } from '../board/format-clock-time.js';
import type { TicketRunPoll } from './fold-ticket-run-poll.js';
import { ticketRunPollIntervalMilliseconds } from './ticket-run-poll-interval-milliseconds.js';

const shownStepCount = 5;
const millisecondsPerMinute = 60_000;

type ActiveRun = NonNullable<TicketRunResponse['activeRun']>;
type LastRun = NonNullable<TicketRunResponse['lastRun']>;

export type RunPanelInput = TicketRunPoll & {
  readonly ticketStatus: TicketStatusResponse;
  readonly stopping: boolean;
};

export type RunPanelStep = {
  readonly at: string;
  readonly time: string;
  readonly summary: string;
  readonly latest: boolean;
};

type LiveRunDescription = {
  readonly kind: 'live';
  readonly startedLabel: string;
  readonly stop: {
    readonly label: string;
    readonly pressable: boolean;
    readonly announcement?: string;
  };
  readonly banner?: string;
  readonly steps: ReadonlyArray<RunPanelStep>;
  readonly emptyMessage?: string;
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
  const lastSteps = activeRun.steps.slice(-shownStepCount);
  return {
    kind: 'live',
    startedLabel: `Started ${describeTimeAgo(activeRun.startedAt, now)}`,
    stop: input.stopping
      ? { label: 'Stopping…', pressable: false, announcement: 'Stopping the run' }
      : { label: 'Stop', pressable: true },
    ...(input.lastPollFailed && input.answeredAt !== undefined
      ? {
          banner: `Can't reach aisf. Showing the steps from ${formatClockTime(input.answeredAt, 'minutes')}; trying again every ${ticketRunPollIntervalMilliseconds / 1000} s.`,
        }
      : {}),
    steps: lastSteps.map((step, position) => ({
      at: step.at,
      time: formatClockTime(step.at, 'seconds'),
      summary: step.summary,
      latest: position === lastSteps.length - 1,
    })),
    ...(lastSteps.length === 0
      ? { emptyMessage: 'Starting the session. Steps show up here as they happen.' }
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
      return 'Run ended: the session finished without opening a pull request.';
    case 'parked':
      return `Run ended: parked until #${ending.blockerNumber} is done.`;
  }
}

function describeRunLength(lastRun: LastRun): string {
  const ranMinutes = Math.floor(
    (Date.parse(lastRun.endedAt) - Date.parse(lastRun.startedAt)) / millisecondsPerMinute,
  );
  return ranMinutes < 1 ? 'ran under 1 min' : `ran ${ranMinutes} min`;
}

export function describeRunPanel(input: RunPanelInput, now: Date): RunPanelDescription {
  const activeRun = input.response?.activeRun;
  if (activeRun !== undefined) {
    return describeLiveRun(activeRun, input, now);
  }
  const lastRun = input.response?.lastRun;
  if (lastRun === undefined || input.ticketStatus !== 'stuck') {
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
