import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FetchGraphQLTicketSource } from '../../../../../src/modules/watcher/infra/integrations/fetch-graphql-ticket-source.js';
import { GitHubRateLimitedError } from '../../../../../src/modules/watcher/logic/errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../../../../../src/modules/watcher/logic/errors/github-request-error.js';
import { FakeGitHubToken } from '../../fakes/fake-github-token.js';
import { ScriptedFetch } from '../../fakes/fake-watcher-ports.js';

const repository = { owner: 'octo', name: 'hello' };
const rawBody = '\n  ## Snapshot\n\n**bold** <details><summary>raw</summary></details>  \n\n';

function readFixture(name: string): string {
  return readFileSync(new URL(`../../../../fixtures/github/${name}`, import.meta.url), 'utf8');
}

function answer(fixtureName: string): Response {
  return new Response(readFixture(fixtureName), { status: 200 });
}

function createSource(scriptedFetch: ScriptedFetch): FetchGraphQLTicketSource {
  return new FetchGraphQLTicketSource({
    fetch: scriptedFetch.fetch,
    token: new FakeGitHubToken(['token']),
    now: () => new Date('2026-09-28T10:00:00Z'),
  });
}

function readRequestBody(
  scriptedFetch: ScriptedFetch,
  requestIndex: number,
): { query: string; variables: unknown } {
  const body = scriptedFetch.requests[requestIndex]?.body;
  return JSON.parse(body ?? '{}') as { query: string; variables: unknown };
}

describe('FetchGraphQLTicketSource', () => {
  describe('snapshot', () => {
    it('should return every open issue once with its mapped fields when two pages are read', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-1.json'),
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.takenAt).toBe('2026-09-28T10:00:00.000Z');
      expect(snapshot.openTickets.map((ticket) => ticket.number)).toEqual([12, 13, 14]);
      expect(snapshot.openTickets[0]).toEqual({
        number: 12,
        title: 'Epic: Watch a project',
        url: 'https://github.com/octo/hello/issues/12',
        body: 'Epic body',
        status: 'planned',
        conflictingStatuses: [],
        hitl: false,
        types: ['enhancement'],
        subIssueNumbers: [13, 14],
        blockedBy: [],
        closingPullRequests: [],
        updatedAt: '2026-09-27T09:47:23Z',
      });
      expect(snapshot.openTickets[1]).toEqual({
        number: 13,
        title: 'Snapshot the tickets',
        url: 'https://github.com/octo/hello/issues/13',
        body: rawBody,
        status: 'in-review',
        conflictingStatuses: [],
        hitl: true,
        types: [],
        parent: { number: 12, title: 'Epic: Watch a project' },
        subIssueNumbers: [],
        blockedBy: [
          { repository: 'octo/hello', number: 9, open: true },
          { repository: 'octo/other', number: 4, open: false },
        ],
        closingPullRequests: [
          {
            number: 21,
            url: 'https://github.com/octo/hello/pull/21',
            state: 'OPEN',
            approved: true,
            checks: 'passing',
            mergeable: 'mergeable',
            canBeRebased: true,
            headCommit: '9f2c1e7a4b8d',
          },
        ],
        updatedAt: '2026-09-28T08:15:02Z',
      });
    });

    it('should ask for the second page with the cursor of the first when more issues remain', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-1.json'),
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      await createSource(scriptedFetch).snapshot(repository);

      expect(scriptedFetch.requests.map((request) => request.url)).toEqual([
        'https://api.github.com/graphql',
        'https://api.github.com/graphql',
        'https://api.github.com/graphql',
      ]);
      expect(readRequestBody(scriptedFetch, 0).variables).toEqual({ owner: 'octo', name: 'hello' });
      expect(readRequestBody(scriptedFetch, 1).variables).toEqual({
        owner: 'octo',
        name: 'hello',
        after: 'cursor-after-page-1',
      });
    });

    it('should report conflicting statuses when an open issue carries two status labels', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-1.json'),
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.openTickets[2]).toMatchObject({
        status: 'conflict',
        conflictingStatuses: ['ready', 'stuck'],
      });
    });

    it('should hold the recently closed tickets and the total count when the closed query answers', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.closedTotalCount).toBe(52);
      expect(snapshot.recentlyClosedTickets.map((ticket) => ticket.number)).toEqual([8, 7]);
      expect(snapshot.recentlyClosedTickets.map((ticket) => ticket.status)).toEqual([
        'closed',
        'closed',
      ]);
      expect(snapshot.recentlyClosedTickets[0]?.closingPullRequests).toEqual([
        {
          number: 20,
          url: 'https://github.com/octo/hello/pull/20',
          state: 'MERGED',
          approved: false,
          checks: 'none',
          mergeable: 'unknown',
          canBeRebased: false,
          headCommit: '0c4d5e6f7a8b',
        },
      ]);
    });

    it('should read the pull request as approved when it carries a label named approved', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-1.json'),
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.openTickets[1]?.closingPullRequests).toEqual([
        expect.objectContaining({ number: 21, approved: true }),
      ]);
    });

    it('should read the pull request as not approved when it has no labels', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.recentlyClosedTickets[0]?.closingPullRequests).toEqual([
        expect.objectContaining({ number: 20, approved: false }),
      ]);
    });

    it('should select the pull request labels and no review decision when the snapshot is taken', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      await createSource(scriptedFetch).snapshot(repository);

      for (const requestIndex of [0, 1]) {
        const query = readRequestBody(scriptedFetch, requestIndex).query;
        expect(query.slice(query.indexOf('closedByPullRequestsReferences'))).toContain('labels');
        expect(query).not.toContain('reviewDecision');
      }
    });

    it('should carry the body of a recently closed issue when the closed query answers', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.recentlyClosedTickets[0]?.body).toBe('Closed body');
    });

    it('should map an empty body to an empty string when the issue has no description', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.openTickets[0]).toHaveProperty('body', '');
      expect(snapshot.recentlyClosedTickets[1]).toHaveProperty('body', '');
    });

    it('should keep markdown, raw html and surrounding whitespace when the body is mapped', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-1.json'),
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      expect(snapshot.openTickets[1]?.body).toBe(rawBody);
    });

    it('should select body and not bodyHTML in the open and the closed query', async () => {
      const scriptedFetch = new ScriptedFetch([
        answer('graphql-open-page-2.json'),
        answer('graphql-closed.json'),
      ]);

      await createSource(scriptedFetch).snapshot(repository);

      for (const requestIndex of [0, 1]) {
        const query = readRequestBody(scriptedFetch, requestIndex).query;
        expect(query).toMatch(/\bbody\b/);
        expect(query).not.toContain('bodyHTML');
      }
    });

    it('should throw GitHubRateLimitedError with retryAt from resetAt when GraphQL reports RATE_LIMITED', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-rate-limited.json')]);

      const failure = createSource(scriptedFetch).snapshot(repository);

      await expect(failure).rejects.toBeInstanceOf(GitHubRateLimitedError);
      await expect(failure).rejects.toMatchObject({ retryAt: new Date('2026-09-28T09:30:00Z') });
    });
  });

  describe('when GitHub answers without the repository', () => {
    it('should throw GitHubRequestError when the snapshot answer has no repository', async () => {
      const scriptedFetch = new ScriptedFetch([
        new Response(
          JSON.stringify({
            data: { repository: null },
            errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a Repository' }],
          }),
          { status: 200 },
        ),
      ]);

      const failure = createSource(scriptedFetch).snapshot(repository);

      await expect(failure).rejects.toBeInstanceOf(GitHubRequestError);
      await expect(failure).rejects.toThrow('Could not resolve to a Repository');
    });
  });

  describe('ticket', () => {
    it('should map a failing rollup and a conflict when the pull request is blocked', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket-blocked-pull-request.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket?.closingPullRequests).toEqual([
        expect.objectContaining({ checks: 'failing', mergeable: 'conflicting' }),
        expect.objectContaining({ checks: 'pending' }),
      ]);
    });

    it('should read the pull request as not approved when it only has labels with other names', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket-blocked-pull-request.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket?.closingPullRequests[0]).toMatchObject({ number: 22, approved: false });
    });

    it('should read the pull request as not approved when its label is named Approved', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket-blocked-pull-request.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket?.closingPullRequests[1]).toMatchObject({ number: 23, approved: false });
    });

    it('should read the ticket types from its type labels when a ticket is read', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket?.types).toEqual(['spike']);
    });

    it('should read the pull request as not approved when only the issue carries the approved label', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket?.closingPullRequests).toEqual([
        expect.objectContaining({ number: 20, approved: false }),
      ]);
    });

    it('should select the pull request labels and no review decision when a ticket is read', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket.json')]);

      await createSource(scriptedFetch).ticket(repository, 8);

      const query = readRequestBody(scriptedFetch, 0).query;
      expect(query.slice(query.indexOf('closedByPullRequestsReferences'))).toContain('labels');
      expect(query).not.toContain('reviewDecision');
    });

    it('should return the ticket with status closed when the number is a closed issue', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket).toMatchObject({
        number: 8,
        status: 'closed',
        parent: { number: 12, title: 'Epic: Watch a project' },
      });
      expect(readRequestBody(scriptedFetch, 0).variables).toMatchObject({ number: 8 });
    });

    it('should carry the body when a single ticket is read', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket?.body).toBe('Ticket body');
    });

    it('should select body and not bodyHTML when a ticket is read', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket.json')]);

      await createSource(scriptedFetch).ticket(repository, 8);

      const query = readRequestBody(scriptedFetch, 0).query;
      expect(query).toMatch(/\bbody\b/);
      expect(query).not.toContain('bodyHTML');
    });

    it('should map an empty body to an empty string when a ticket without description is read', async () => {
      const scriptedFetch = new ScriptedFetch([
        new Response(readFixture('graphql-ticket.json').replace('"Ticket body"', '""'), {
          status: 200,
        }),
      ]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket).toHaveProperty('body', '');
    });

    it('should return undefined when the number is a pull request', async () => {
      const scriptedFetch = new ScriptedFetch([
        new Response(
          JSON.stringify({
            data: { repository: { issueOrPullRequest: { __typename: 'PullRequest' } } },
          }),
          { status: 200 },
        ),
      ]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 20);

      expect(ticket).toBeUndefined();
    });

    it('should return undefined when the number does not exist', async () => {
      const scriptedFetch = new ScriptedFetch([
        new Response(
          JSON.stringify({
            data: { repository: { issueOrPullRequest: null } },
            errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }],
          }),
          { status: 200 },
        ),
      ]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 99999);

      expect(ticket).toBeUndefined();
    });
  });
});
