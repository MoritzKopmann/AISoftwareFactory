import type {
  NeedsYouResponse,
  NeedsYouRowResponse,
} from '@aisf/app/api-schemas/needs-you-schemas.js';
import { describeElapsedTime } from './describe-elapsed-time.js';
import { describeTicketStatusMark, type StatusMarkTone } from './describe-ticket-status-mark.js';
import type { NeedsYouOutcome } from './fetch-needs-you.js';

export type NeedsYouState = {
  readonly response: NeedsYouResponse | undefined;
  readonly failureDetail: string | undefined;
};

export const initialNeedsYouState: NeedsYouState = {
  response: undefined,
  failureDetail: undefined,
};

export function foldNeedsYouOutcome(state: NeedsYouState, outcome: NeedsYouOutcome): NeedsYouState {
  return outcome.kind === 'answer'
    ? { response: outcome.response, failureDetail: undefined }
    : { response: state.response, failureDetail: outcome.detail };
}

export type NeedsYouEntry = {
  readonly ticketNumber: number;
  readonly numberLabel: string;
  readonly title: string;
  readonly shape: string;
  readonly tone: StatusMarkTone;
  readonly actionText: string;
  readonly waitLabel: string;
  readonly href: string;
};

export type NeedsYouDescription =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string; readonly detail: string }
  | { readonly kind: 'empty'; readonly count: number; readonly message: string }
  | {
      readonly kind: 'list';
      readonly count: number;
      readonly entries: ReadonlyArray<NeedsYouEntry>;
    };

const actionTexts: Readonly<Record<NeedsYouRowResponse['action'], string>> = {
  'answer-round': 'Answer a round',
  'answer-question': 'Answer a question',
  'allow-permission': 'Allow or deny a permission',
  'decide-stuck': 'Decide how the stuck ticket continues',
  'review-pull-request': 'Review the PR',
};

export function describeNeedsYou(
  state: NeedsYouState,
  projectId: string,
  now: Date,
): NeedsYouDescription {
  if (state.failureDetail !== undefined) {
    return {
      kind: 'failed',
      message: "Couldn't load what needs you.",
      detail: state.failureDetail,
    };
  }
  if (state.response === undefined) {
    return { kind: 'loading' };
  }
  if (state.response.rows.length === 0) {
    return { kind: 'empty', count: 0, message: 'Nothing is waiting for you' };
  }
  return {
    kind: 'list',
    count: state.response.rows.length,
    entries: state.response.rows.map((row) => {
      const mark = describeTicketStatusMark(row.action === 'decide-stuck' ? 'stuck' : 'waiting');
      return {
        ticketNumber: row.ticketNumber,
        numberLabel: `#${row.ticketNumber}`,
        title: row.title,
        shape: mark.shape,
        tone: mark.tone,
        actionText: actionTexts[row.action],
        waitLabel: describeElapsedTime(row.since, now),
        href: `#/projects/${projectId}/tickets/${row.ticketNumber}`,
      };
    }),
  };
}
