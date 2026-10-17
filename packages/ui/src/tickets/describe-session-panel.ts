import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { formatClockTime } from '../board/format-clock-time.js';
import type { LiveRunDescription, RunPanelDescription } from './describe-run-panel.js';
import type { SessionView } from './fold-session-view.js';

type LastRun = Pick<NonNullable<TicketRunResponse['lastRun']>, 'startedAt' | 'endedAt'>;

export type SessionPanelDescription = {
  readonly label: 'Run' | 'Session';
  readonly rail: 'info' | 'border-strong' | 'danger';
  readonly head:
    | { readonly kind: 'live'; readonly run: LiveRunDescription }
    | { readonly kind: 'session'; readonly timeRange?: string };
  readonly connectionBanner?: { readonly line: string; readonly note: string };
};

const connectionBanner = {
  line: 'Connection lost. Reconnecting…',
  note: 'What is shown stays. New entries continue once it is back.',
};

function describeTimeRange(view: SessionView, lastRun: LastRun | undefined): string | undefined {
  if (view.kind !== 'entries' || !view.ended || lastRun === undefined) return undefined;
  return `${formatClockTime(lastRun.startedAt, 'minutes')} – ${formatClockTime(lastRun.endedAt, 'minutes')}`;
}

export function describeSessionPanel(
  run: RunPanelDescription,
  view: SessionView,
  lastRun: LastRun | undefined,
): SessionPanelDescription {
  const banner = view.kind === 'entries' && view.connectionLost ? { connectionBanner } : {};
  if (run.kind === 'live') {
    return { label: 'Run', rail: 'info', head: { kind: 'live', run }, ...banner };
  }
  const timeRange = describeTimeRange(view, lastRun);
  return {
    label: 'Session',
    rail: view.kind === 'transcript-not-found' ? 'danger' : 'border-strong',
    head: { kind: 'session', ...(timeRange === undefined ? {} : { timeRange }) },
    ...banner,
  };
}
