import { describe, expect, it } from 'vitest';
import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { formatClockTime } from '../../src/board/format-clock-time.js';
import {
  describeTicketPage,
  outcomeFromAnswer,
  type TicketPageOutcome,
} from '../../src/tickets/describe-ticket-page.js';
import {
  buildClosingPullRequestResponse,
  buildTicketResponse,
} from '../board/fixtures/ticket-response.js';

const projectId = 'MoritzKopmann/postkarte';

function answered(ticket: TicketResponse): TicketPageOutcome {
  return {
    kind: 'answered',
    response: { projectId, sync: { state: 'pending' }, ticket },
  };
}

describe('outcomeFromAnswer', () => {
  const unreadableBody = (): Promise<unknown> => Promise.reject(new SyntaxError('not JSON'));

  it('should be not-found when the route answered 404, whatever the body', async () => {
    expect(await outcomeFromAnswer(404, unreadableBody)).toEqual({ kind: 'not-found' });
  });

  it('should carry the response when the route answered 200', async () => {
    const response = { projectId, sync: { state: 'pending' } } as const;

    expect(await outcomeFromAnswer(200, () => Promise.resolve(response))).toEqual({
      kind: 'answered',
      response,
    });
  });

  it('should be request-failed with the status when the route answered another error, whatever the body', async () => {
    expect(await outcomeFromAnswer(500, unreadableBody)).toEqual({
      kind: 'request-failed',
      message: 'The ticket route answered 500.',
    });
  });
});

function failedSync(failure: {
  readonly cause: 'auth' | 'rate-limited' | 'unavailable' | 'unexpected';
  readonly message: string;
  readonly retryAt?: string;
}): TicketPageOutcome {
  return {
    kind: 'answered',
    response: {
      projectId,
      sync: { state: 'failed', failedAt: '2026-09-28T11:59:00Z', ...failure },
    },
  };
}

describe('describeTicketPage', () => {
  it('should name the ticket in a loading label when the request is in flight', () => {
    expect(describeTicketPage({ kind: 'loading' }, projectId, 46)).toEqual({
      kind: 'loading',
      loadingLabel: 'Loading #46…',
    });
  });

  it('should name the ticket and the project without a retry when the ticket is not found', () => {
    expect(describeTicketPage({ kind: 'not-found' }, projectId, 999)).toEqual({
      kind: 'not-found',
      message: "#999 isn't a ticket in MoritzKopmann/postkarte.",
    });
  });

  it('should describe the number, title, status, link and no parent or pull requests when the ticket has none', () => {
    const ticket = buildTicketResponse({
      number: 36,
      title: 'Envelope flip animation',
      url: 'https://github.com/MoritzKopmann/postkarte/issues/36',
      status: 'closed',
    });

    expect(describeTicketPage(answered(ticket), projectId, 36)).toEqual({
      kind: 'loaded',
      numberLabel: '#36',
      title: 'Envelope flip animation',
      status: 'closed',
      statusLabel: 'Closed',
      statusMark: { shape: '✓', tone: 'done', pulses: false },
      url: 'https://github.com/MoritzKopmann/postkarte/issues/36',
      body: '',
      runSkill: 'implement-ticket',
      pullRequests: [],
    });
  });

  it('should pass the ticket body on when the ticket loads', () => {
    const ticket = buildTicketResponse({ body: '## Spec\n\nText' });

    expect(describeTicketPage(answered(ticket), projectId, 1)).toMatchObject({
      body: '## Spec\n\nText',
    });
  });

  it('should run the spike skill when the ticket types include spike', () => {
    const ticket = buildTicketResponse({ types: ['spike'] });

    expect(describeTicketPage(answered(ticket), projectId, 1)).toMatchObject({
      runSkill: 'spike',
    });
  });

  it('should run implement-ticket when the ticket types do not include spike', () => {
    const ticket = buildTicketResponse({ types: ['enhancement'] });

    expect(describeTicketPage(answered(ticket), projectId, 1)).toMatchObject({
      runSkill: 'implement-ticket',
    });
  });

  it('should pass the raw status on when the ticket loads', () => {
    const ticket = buildTicketResponse({ status: 'stuck' });

    expect(describeTicketPage(answered(ticket), projectId, 1)).toMatchObject({
      status: 'stuck',
    });
  });

  it('should link the parent to its in-app ticket page when the ticket has a parent', () => {
    const ticket = buildTicketResponse({ parent: { number: 40, title: 'Small-screen polish' } });

    const description = describeTicketPage(answered(ticket), projectId, 1);

    expect(description).toMatchObject({
      parent: {
        href: '#/projects/MoritzKopmann/postkarte/tickets/40',
        numberLabel: '#40',
        title: 'Small-screen polish',
      },
    });
  });

  it('should list each closing pull request with its url and lowercase state when there are some', () => {
    const ticket = buildTicketResponse({
      closingPullRequests: [
        buildClosingPullRequestResponse({ number: 52 }),
        buildClosingPullRequestResponse({ number: 54, state: 'MERGED' }),
      ],
    });

    const description = describeTicketPage(answered(ticket), projectId, 1);

    expect(description).toMatchObject({
      pullRequests: [
        { label: 'PR #52', url: 'https://github.com/o/n/pull/52', state: 'open' },
        { label: 'PR #54', url: 'https://github.com/o/n/pull/54', state: 'merged' },
      ],
    });
  });

  it('should say aisf cannot be reached and keep the raw message when the request failed', () => {
    const description = describeTicketPage(
      { kind: 'request-failed', message: 'Failed to fetch' },
      projectId,
      36,
    );

    expect(description).toEqual({
      kind: 'failed',
      message: "Couldn't load #36. Can't reach aisf.",
      detail: 'Failed to fetch',
    });
  });

  it('should give the timeout cause and the raw message when the sync failed with no ticket', () => {
    const description = describeTicketPage(
      failedSync({ cause: 'unavailable', message: 'gh: HTTP 504 Gateway Timeout' }),
      projectId,
      36,
    );

    expect(description).toEqual({
      kind: 'failed',
      message: "Couldn't load #36. GitHub didn't answer in time.",
      detail: 'gh: HTTP 504 Gateway Timeout',
    });
  });

  it('should show the retry time of day when the sync is rate-limited', () => {
    const retryAt = '2026-09-28T12:02:10Z';
    const description = describeTicketPage(
      failedSync({ cause: 'rate-limited', message: 'API rate limit exceeded', retryAt }),
      projectId,
      36,
    );

    expect(description).toEqual({
      kind: 'failed',
      message: `Couldn't load #36. GitHub rate limit reached; resuming at ${formatClockTime(retryAt, 'minutes')}.`,
      detail: 'API rate limit exceeded',
    });
  });

  it('should still show the retry time when it has passed', () => {
    const retryAt = '2026-09-28T11:59:00Z';
    const description = describeTicketPage(
      failedSync({ cause: 'rate-limited', message: 'limit', retryAt }),
      projectId,
      36,
    );

    expect(description).toMatchObject({
      message: `Couldn't load #36. GitHub rate limit reached; resuming at ${formatClockTime(retryAt, 'minutes')}.`,
    });
  });

  it('should say resuming soon when the rate limit gives no retry time', () => {
    const description = describeTicketPage(
      failedSync({ cause: 'rate-limited', message: 'limit' }),
      projectId,
      36,
    );

    expect(description).toMatchObject({
      message: "Couldn't load #36. GitHub rate limit reached; resuming soon.",
    });
  });

  it('should name the login command when the sync failed on auth', () => {
    const description = describeTicketPage(
      failedSync({ cause: 'auth', message: 'You are not logged in' }),
      projectId,
      36,
    );

    expect(description).toEqual({
      kind: 'failed',
      message: "Couldn't load #36. gh isn't logged in. Run:",
      command: 'gh auth login',
      detail: 'You are not logged in',
    });
  });

  it('should point at the aisf log when the sync failed unexpectedly', () => {
    const description = describeTicketPage(
      failedSync({ cause: 'unexpected', message: 'boom' }),
      projectId,
      36,
    );

    expect(description).toEqual({
      kind: 'failed',
      message: "Couldn't load #36. The watcher hit an unexpected error; see the aisf log.",
      detail: 'boom',
    });
  });

  it('should show the ticket when the sync failed but the response still holds it', () => {
    const outcome: TicketPageOutcome = {
      kind: 'answered',
      response: {
        projectId,
        sync: {
          state: 'failed',
          cause: 'unavailable',
          message: 'timeout',
          failedAt: '2026-09-28T11:59:00Z',
        },
        ticket: buildTicketResponse({ number: 7 }),
      },
    };

    expect(describeTicketPage(outcome, projectId, 7)).toMatchObject({
      kind: 'loaded',
      numberLabel: '#7',
    });
  });

  it('should carry the pulsing mark when the ticket is in progress', () => {
    const ticket = buildTicketResponse({ status: 'in-progress' });

    const description = describeTicketPage(answered(ticket), projectId, 1);

    expect(description).toMatchObject({
      statusLabel: 'In progress',
      statusMark: { pulses: true },
    });
  });
});
