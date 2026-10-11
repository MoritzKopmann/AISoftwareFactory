import type {
  NeedsYouResponse,
  NeedsYouRowResponse,
} from '@aisf/app/api-schemas/needs-you-schemas.js';
import type { NeedsYouOutcome } from './fetch-needs-you.js';

export type NeedsYouState = {
  readonly response: NeedsYouResponse | undefined;
  readonly failed: boolean;
};

export const initialNeedsYouState: NeedsYouState = { response: undefined, failed: false };

export function foldNeedsYouOutcome(state: NeedsYouState, outcome: NeedsYouOutcome): NeedsYouState {
  return outcome.kind === 'answer'
    ? { response: outcome.response, failed: false }
    : { response: state.response, failed: true };
}

export type NeedsYouEntry = {
  readonly ticketNumber: number;
  readonly numberLabel: string;
  readonly title: string;
  readonly actionText: string;
  readonly href: string;
};

export type NeedsYouDescription =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'empty'; readonly message: string }
  | { readonly kind: 'list'; readonly entries: ReadonlyArray<NeedsYouEntry> };

const actionTexts: Readonly<Record<NeedsYouRowResponse['action'], string>> = {
  'answer-round': 'Answer the round',
  'answer-question': 'Answer the question',
  'allow-permission': 'Allow or deny a permission',
  'decide-stuck': 'Decide on the stuck ticket',
  'review-pull-request': 'Review the pull request',
};

export function describeNeedsYou(state: NeedsYouState, projectId: string): NeedsYouDescription {
  if (state.failed) {
    return { kind: 'failed', message: "Couldn't load what needs you. Can't reach aisf." };
  }
  if (state.response === undefined) {
    return { kind: 'loading' };
  }
  if (state.response.rows.length === 0) {
    return { kind: 'empty', message: 'Nothing is waiting for you' };
  }
  return {
    kind: 'list',
    entries: state.response.rows.map((row) => ({
      ticketNumber: row.ticketNumber,
      numberLabel: `#${row.ticketNumber}`,
      title: row.title,
      actionText: actionTexts[row.action],
      href: `#/projects/${projectId}/tickets/${row.ticketNumber}`,
    })),
  };
}
