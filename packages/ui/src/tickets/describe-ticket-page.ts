import type {
  ProjectTicketResponse,
  SyncStatusResponse,
  TicketResponse,
} from '@aisf/app/api-schemas/tickets-schemas.js';
import { describeTicketStatusMark, type StatusMark } from '../board/describe-ticket-status-mark.js';
import { ticketStatusLabel } from '../board/ticket-status-labels.js';

export type TicketPageOutcome =
  | { readonly kind: 'loading' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'request-failed'; readonly message: string }
  | { readonly kind: 'answered'; readonly response: ProjectTicketResponse };

export type TicketPageDescription =
  | { readonly kind: 'loading'; readonly loadingLabel: string }
  | { readonly kind: 'not-found'; readonly message: string }
  | {
      readonly kind: 'failed';
      readonly message: string;
      readonly command?: string;
      readonly detail: string;
    }
  | {
      readonly kind: 'loaded';
      readonly numberLabel: string;
      readonly title: string;
      readonly statusLabel: string;
      readonly statusMark: StatusMark;
      readonly url: string;
      readonly parent?: {
        readonly href: string;
        readonly numberLabel: string;
        readonly title: string;
      };
      readonly pullRequests: ReadonlyArray<{
        readonly label: string;
        readonly url: string;
        readonly state: string;
      }>;
    };

function describeLoadedTicket(ticket: TicketResponse, projectId: string): TicketPageDescription {
  return {
    kind: 'loaded',
    numberLabel: `#${ticket.number}`,
    title: ticket.title,
    statusLabel: ticketStatusLabel(ticket.status),
    statusMark: describeTicketStatusMark(ticket.status),
    url: ticket.url,
    ...(ticket.parent === undefined
      ? {}
      : {
          parent: {
            href: `#/projects/${projectId}/tickets/${ticket.parent.number}`,
            numberLabel: `#${ticket.parent.number}`,
            title: ticket.parent.title,
          },
        }),
    pullRequests: ticket.closingPullRequests.map((pullRequest) => ({
      label: `PR #${pullRequest.number}`,
      url: pullRequest.url,
      state: pullRequest.state.toLowerCase(),
    })),
  };
}

export async function outcomeFromAnswer(
  httpStatus: number,
  readBody: () => Promise<unknown>,
): Promise<TicketPageOutcome> {
  if (httpStatus === 404) {
    return { kind: 'not-found' };
  }
  if (httpStatus === 200) {
    return { kind: 'answered', response: (await readBody()) as ProjectTicketResponse };
  }
  return { kind: 'request-failed', message: `The ticket route answered ${httpStatus}.` };
}

type FailureCause = { readonly cause: string; readonly command?: string };

const unexpectedCause = 'The watcher hit an unexpected error; see the aisf log.';

function describeSyncCause(
  sync: Extract<SyncStatusResponse, { state: 'failed' }>,
  now: number,
): FailureCause {
  switch (sync.cause) {
    case 'unavailable':
      return { cause: "GitHub didn't answer in time." };
    case 'rate-limited': {
      if (sync.retryAt === undefined) {
        return { cause: 'GitHub rate limit reached; resuming soon.' };
      }
      const minutes = Math.max(1, Math.ceil((Date.parse(sync.retryAt) - now) / 60_000));
      return { cause: `GitHub rate limit reached; resuming in ${minutes} min.` };
    }
    case 'auth':
      return { cause: "gh isn't logged in. Run:", command: 'gh auth login' };
    case 'unexpected':
      return { cause: unexpectedCause };
  }
}

function failed(number: number, failure: FailureCause, detail: string): TicketPageDescription {
  return {
    kind: 'failed',
    message: `Couldn't load #${number}. ${failure.cause}`,
    ...(failure.command === undefined ? {} : { command: failure.command }),
    detail,
  };
}

export function describeTicketPage(
  outcome: TicketPageOutcome,
  projectId: string,
  number: number,
  now: number,
): TicketPageDescription {
  switch (outcome.kind) {
    case 'loading':
      return { kind: 'loading', loadingLabel: `Loading #${number}…` };
    case 'not-found':
      return { kind: 'not-found', message: `#${number} isn't a ticket in ${projectId}.` };
    case 'request-failed':
      return failed(number, { cause: "Can't reach aisf." }, outcome.message);
    case 'answered': {
      const { ticket, sync } = outcome.response;
      if (ticket !== undefined) {
        return describeLoadedTicket(ticket, projectId);
      }
      if (sync.state !== 'failed') {
        return failed(number, { cause: unexpectedCause }, '');
      }
      return failed(number, describeSyncCause(sync, now), sync.message);
    }
  }
}
