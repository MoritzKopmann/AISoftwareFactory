import type { FindingResponse } from '@aisf/app/api-schemas/findings-schemas.js';
import { formatClockTime } from '../board/format-clock-time.js';
import { findingsPollIntervalMilliseconds } from './findings-poll-interval-milliseconds.js';
import type { FindingsFailure, FindingsPoll } from './fold-findings-poll.js';

const firstRowCount = 20;
const findingNotOpenStatus = 409;

export type FindingPress =
  | { readonly kind: 'creating' }
  | { readonly kind: 'dismissing' }
  | { readonly kind: 'created'; readonly ticketNumber: number }
  | { readonly kind: 'dismissed' }
  | {
      readonly kind: 'failed';
      readonly action: 'create-ticket' | 'dismiss';
      readonly failure: FindingsFailure;
    };

export type KnownBugRowAction =
  | { readonly kind: 'idle' }
  | { readonly kind: 'creating' }
  | { readonly kind: 'dismissing' }
  | { readonly kind: 'created'; readonly ticketLabel: string; readonly ticketHref: string }
  | { readonly kind: 'failed'; readonly message: string; readonly detail: string };

export type KnownBugRow = {
  readonly id: number;
  readonly chipLabel: 'Bug' | 'Gap';
  readonly chipTone: 'danger' | 'warn';
  readonly summary: string;
  readonly location: string;
  readonly sourceLabel: string;
  readonly sourceHref: string;
  readonly action: KnownBugRowAction;
};

export type KnownBugsDescription =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string; readonly detail: string }
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'list';
      readonly countLabel: string;
      readonly rows: ReadonlyArray<KnownBugRow>;
      readonly banner?: string;
      readonly footer?: string;
    };

function describeCause(failure: FindingsFailure): {
  readonly cause: string;
  readonly detail: string;
} {
  if (failure.kind === 'not-ok') {
    return {
      cause: `The findings route answered ${failure.status}.`,
      detail: String(failure.status),
    };
  }
  return { cause: "Can't reach aisf.", detail: failure.message };
}

function describeFailure(failure: FindingsFailure): KnownBugsDescription {
  const { cause, detail } = describeCause(failure);
  return { kind: 'error', message: `Couldn't load known bugs. ${cause}`, detail };
}

function describeFailedPress(
  action: 'create-ticket' | 'dismiss',
  failure: FindingsFailure,
): KnownBugRowAction {
  const lead =
    action === 'create-ticket' ? "Couldn't create the ticket." : "Couldn't dismiss the finding.";
  const { cause, detail } = describeCause(failure);
  const findingNotOpen = failure.kind === 'not-ok' && failure.status === findingNotOpenStatus;
  return {
    kind: 'failed',
    message: `${lead} ${findingNotOpen ? 'It is already ticketed or dismissed.' : cause}`,
    detail,
  };
}

function ticketHref(projectId: string, ticketNumber: number): string {
  return `#/projects/${projectId}/tickets/${ticketNumber}`;
}

function describeAction(
  finding: FindingResponse,
  press: FindingPress | undefined,
  projectId: string,
): KnownBugRowAction {
  if (press?.kind === 'created') {
    return {
      kind: 'created',
      ticketLabel: `#${press.ticketNumber}`,
      ticketHref: ticketHref(projectId, press.ticketNumber),
    };
  }
  if (press?.kind === 'creating' || press?.kind === 'dismissing') {
    return { kind: press.kind };
  }
  if (finding.state === 'creating') {
    return { kind: 'creating' };
  }
  return press?.kind === 'failed'
    ? describeFailedPress(press.action, press.failure)
    : { kind: 'idle' };
}

function isListed(finding: FindingResponse, press: FindingPress | undefined): boolean {
  if (press?.kind === 'created') {
    return true;
  }
  if (press?.kind === 'dismissed') {
    return false;
  }
  return finding.state === 'open' || finding.state === 'creating';
}

function describeRow(
  finding: FindingResponse,
  press: FindingPress | undefined,
  projectId: string,
): KnownBugRow {
  return {
    id: finding.id,
    chipLabel: finding.kind === 'bug' ? 'Bug' : 'Gap',
    chipTone: finding.kind === 'bug' ? 'danger' : 'warn',
    summary: finding.summary,
    location: finding.location,
    sourceLabel: `#${finding.ticketNumber}`,
    sourceHref: ticketHref(projectId, finding.ticketNumber),
    action: describeAction(finding, press, projectId),
  };
}

export function describeKnownBugs(
  poll: FindingsPoll,
  presses: ReadonlyMap<number, FindingPress>,
  projectId: string,
  showAll: boolean,
): KnownBugsDescription {
  if (poll.findings === undefined) {
    return poll.failure === undefined ? { kind: 'loading' } : describeFailure(poll.failure);
  }
  const listed = poll.findings.filter((finding) => isListed(finding, presses.get(finding.id)));
  if (listed.length === 0) {
    return { kind: 'empty' };
  }
  const createdCount = listed.filter(
    (finding) => presses.get(finding.id)?.kind === 'created',
  ).length;
  const cut = !showAll && listed.length > firstRowCount;
  const shown = cut ? listed.slice(0, firstRowCount) : listed;
  return {
    kind: 'list',
    countLabel: String(listed.length - createdCount),
    rows: shown.map((finding) => describeRow(finding, presses.get(finding.id), projectId)),
    ...(poll.failure !== undefined && poll.answeredAt !== undefined
      ? {
          banner: `Can't reach aisf. Showing the list from ${formatClockTime(poll.answeredAt, 'minutes')}; trying again every ${findingsPollIntervalMilliseconds / 1000} s.`,
        }
      : {}),
    ...(cut ? { footer: `Showing ${firstRowCount} of ${listed.length}.` } : {}),
  };
}
