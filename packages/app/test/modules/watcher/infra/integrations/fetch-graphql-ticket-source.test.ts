import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FetchGraphQLTicketSource } from '../../../../../src/modules/watcher/infra/integrations/fetch-graphql-ticket-source.js';
import { GitHubRateLimitedError } from '../../../../../src/modules/watcher/logic/errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../../../../../src/modules/watcher/logic/errors/github-request-error.js';
import { FakeGitHubToken, ScriptedFetch } from '../../fakes/fake-watcher-ports.js';

const repository = { owner: 'octo', name: 'hello' };

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

function readVariables(scriptedFetch: ScriptedFetch, requestIndex: number): unknown {
  const body = scriptedFetch.requests[requestIndex]?.body;
  return (JSON.parse(body ?? '{}') as { variables: unknown }).variables;
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
        status: 'planned',
        conflictingStatuses: [],
        hitl: false,
        subIssueNumbers: [13, 14],
        blockedBy: [],
        closingPullRequests: [],
        updatedAt: '2026-09-27T09:47:23Z',
      });
      expect(snapshot.openTickets[1]).toEqual({
        number: 13,
        title: 'Snapshot the tickets',
        url: 'https://github.com/octo/hello/issues/13',
        status: 'in-review',
        conflictingStatuses: [],
        hitl: true,
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
            reviewDecision: 'APPROVED',
            checks: 'passing',
            mergeable: 'mergeable',
            canBeRebased: true,
            headCommit: '9f2c1ab',
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
      expect(readVariables(scriptedFetch, 0)).toEqual({ owner: 'octo', name: 'hello' });
      expect(readVariables(scriptedFetch, 1)).toEqual({
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
          reviewDecision: 'none',
          checks: 'none',
          mergeable: 'unknown',
          canBeRebased: false,
          headCommit: '4d7e0c3',
        },
      ]);
    });

    it('should map each rollup state to a checks value when the head commit has one', async () => {
      const rollupStates = ['SUCCESS', 'FAILURE', 'ERROR', 'PENDING', 'EXPECTED'];
      const pullRequests = rollupStates.map((state, index) => ({
        number: index + 1,
        url: 'u',
        state: 'OPEN',
        reviewDecision: 'CHANGES_REQUESTED',
        mergeable: 'CONFLICTING',
        canBeRebased: false,
        headRefOid: 'abc',
        commits: { nodes: [{ commit: { statusCheckRollup: { state } } }] },
      }));
      const scriptedFetch = new ScriptedFetch([
        new Response(
          JSON.stringify({
            data: {
              repository: {
                issues: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      number: 1,
                      title: 't',
                      url: 'u',
                      updatedAt: 'x',
                      labels: { nodes: [] },
                      parent: null,
                      subIssues: { nodes: [] },
                      blockedBy: { nodes: [] },
                      closedByPullRequestsReferences: { nodes: pullRequests },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        ),
        answer('graphql-closed.json'),
      ]);

      const snapshot = await createSource(scriptedFetch).snapshot(repository);

      const closingPullRequests = snapshot.openTickets[0]?.closingPullRequests ?? [];
      const [firstPullRequest] = closingPullRequests;
      expect(
        snapshot.openTickets[0]?.closingPullRequests.map((pullRequest) => pullRequest.checks),
      ).toEqual(['passing', 'failing', 'failing', 'pending', 'pending']);
      expect(firstPullRequest).toMatchObject({
        reviewDecision: 'CHANGES_REQUESTED',
        mergeable: 'conflicting',
      });
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
    it('should return the ticket with status closed when the number is a closed issue', async () => {
      const scriptedFetch = new ScriptedFetch([answer('graphql-ticket.json')]);

      const ticket = await createSource(scriptedFetch).ticket(repository, 8);

      expect(ticket).toMatchObject({
        number: 8,
        status: 'closed',
        parent: { number: 12, title: 'Epic: Watch a project' },
      });
      expect(readVariables(scriptedFetch, 0)).toMatchObject({ number: 8 });
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
