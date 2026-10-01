import type { FindingResponse } from '@aisf/app/api-schemas/findings-schemas.js';
import { formatClockTime } from '../board/format-clock-time.js';
import { findingsPollIntervalMilliseconds } from './findings-poll-interval-milliseconds.js';
import type { FindingsFailure, FindingsPoll } from './fold-findings-poll.js';

const firstRowCount = 20;

export type KnownBugRow = {
  readonly id: number;
  readonly chipLabel: 'Bug' | 'Gap';
  readonly chipTone: 'danger' | 'warn';
  readonly summary: string;
  readonly location: string;
  readonly sourceLabel: string;
  readonly sourceHref: string;
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

function describeFailure(failure: FindingsFailure): KnownBugsDescription {
  if (failure.kind === 'not-ok') {
    return {
      kind: 'error',
      message: `Couldn't load known bugs. The findings route answered ${failure.status}.`,
      detail: String(failure.status),
    };
  }
  return {
    kind: 'error',
    message: "Couldn't load known bugs. Can't reach aisf.",
    detail: failure.message,
  };
}

function describeRow(finding: FindingResponse, projectId: string): KnownBugRow {
  return {
    id: finding.id,
    chipLabel: finding.kind === 'bug' ? 'Bug' : 'Gap',
    chipTone: finding.kind === 'bug' ? 'danger' : 'warn',
    summary: finding.summary,
    location: finding.location,
    sourceLabel: `#${finding.ticketNumber}`,
    sourceHref: `#/projects/${projectId}/tickets/${finding.ticketNumber}`,
  };
}

export function describeKnownBugs(
  poll: FindingsPoll,
  projectId: string,
  showAll: boolean,
): KnownBugsDescription {
  if (poll.findings === undefined) {
    return poll.failure === undefined ? { kind: 'loading' } : describeFailure(poll.failure);
  }
  const listed = poll.findings.filter(
    (finding) => finding.state === 'open' || finding.state === 'creating',
  );
  if (listed.length === 0) {
    return { kind: 'empty' };
  }
  const cut = !showAll && listed.length > firstRowCount;
  const shown = cut ? listed.slice(0, firstRowCount) : listed;
  return {
    kind: 'list',
    countLabel: String(listed.length),
    rows: shown.map((finding) => describeRow(finding, projectId)),
    ...(poll.failure !== undefined && poll.answeredAt !== undefined
      ? {
          banner: `Can't reach aisf. Showing the list from ${formatClockTime(poll.answeredAt, 'minutes')}; trying again every ${findingsPollIntervalMilliseconds / 1000} s.`,
        }
      : {}),
    ...(cut ? { footer: `Showing ${firstRowCount} of ${listed.length}.` } : {}),
  };
}
