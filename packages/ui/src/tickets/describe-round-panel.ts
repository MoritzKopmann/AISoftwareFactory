import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { formatClockTime } from '../board/format-clock-time.js';
import { ticketStatusLabel } from '../board/ticket-status-labels.js';
import { countRunMinutes } from './count-run-minutes.js';
import { describeStopAction, type StopActionDescription } from './describe-stop-action.js';
import { waitingPage } from './waiting-page.js';

export type RoundPanelContext = {
  readonly ticketStatus: TicketStatusResponse;
  readonly ticketNumber: number;
  readonly roundRunId: string | undefined;
  readonly stopping: boolean;
};

export type RoundPanelDescription =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'shown';
      readonly title: string;
      readonly url: string;
      readonly subtitle: string;
      // Absent when the run has ended: Stop needs an active run.
      readonly stop?: StopActionDescription;
    }
  | { readonly kind: 'ended'; readonly endedLabel: string; readonly note: string };

function describeEndedRound(
  response: TicketRunResponse | undefined,
  roundRunId: string | undefined,
): RoundPanelDescription {
  const lastRun = response?.lastRun;
  if (
    response?.activeRun !== undefined ||
    lastRun === undefined ||
    lastRun.id !== roundRunId ||
    lastRun.ending.kind === 'checkpoint'
  ) {
    return { kind: 'hidden' };
  }
  return {
    kind: 'ended',
    endedLabel: `Ended ${formatClockTime(lastRun.endedAt, 'minutes')} · ${countRunMinutes(lastRun)} min`,
    note: 'The run ended before this round was answered.',
  };
}

export function describeRoundPanel(
  response: TicketRunResponse | undefined,
  context: RoundPanelContext,
): RoundPanelDescription {
  const page = waitingPage(response);
  if (page === undefined) {
    return describeEndedRound(response, context.roundRunId);
  }
  const { title, url } = page;
  return {
    kind: 'shown',
    title,
    url,
    subtitle: `${ticketStatusLabel(context.ticketStatus)} #${context.ticketNumber} · ${title}`,
    ...(response?.activeRun === undefined ? {} : { stop: describeStopAction(context.stopping) }),
  };
}
