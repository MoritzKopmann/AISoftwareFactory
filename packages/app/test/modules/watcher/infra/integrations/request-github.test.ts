import { describe, expect, it } from 'vitest';
import { requestGitHub } from '../../../../../src/modules/watcher/infra/integrations/request-github.js';
import { GitHubAuthError } from '../../../../../src/modules/watcher/logic/errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../../../../../src/modules/watcher/logic/errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../../../../../src/modules/watcher/logic/errors/github-request-error.js';
import { FakeGitHubToken } from '../../fakes/fake-github-token.js';
import { ScriptedFetch } from '../../fakes/fake-watcher-ports.js';

const feedUrl = 'https://api.github.com/repos/octo/hello/issues';

describe('requestGitHub', () => {
  it('should send the bearer token and a timeout signal when the request succeeds', async () => {
    const scriptedFetch = new ScriptedFetch([new Response('[]', { status: 200 })]);
    const token = new FakeGitHubToken(['first-token']);

    const response = await requestGitHub(
      { fetch: scriptedFetch.fetch, token, timeoutMilliseconds: 1000 },
      feedUrl,
    );

    expect(response.status).toBe(200);
    expect(scriptedFetch.requests[0]?.headers.get('authorization')).toBe('Bearer first-token');
    expect(scriptedFetch.requests[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('should POST the body as JSON when a body is given', async () => {
    const scriptedFetch = new ScriptedFetch([new Response('{}', { status: 200 })]);

    await requestGitHub(
      {
        fetch: scriptedFetch.fetch,
        token: new FakeGitHubToken(['token']),
        timeoutMilliseconds: 1000,
      },
      'https://api.github.com/graphql',
      {},
      '{"query":"{ viewer { login } }"}',
    );

    expect(scriptedFetch.requests[0]?.method).toBe('POST');
    expect(scriptedFetch.requests[0]?.body).toBe('{"query":"{ viewer { login } }"}');
    expect(scriptedFetch.requests[0]?.headers.get('content-type')).toBe('application/json');
  });

  it('should invalidate and re-read the token once when the first answer is a 401', async () => {
    const scriptedFetch = new ScriptedFetch([
      new Response('', { status: 401 }),
      new Response('[]', { status: 200 }),
    ]);
    const token = new FakeGitHubToken(['stale-token', 'fresh-token']);

    const response = await requestGitHub(
      { fetch: scriptedFetch.fetch, token, timeoutMilliseconds: 1000 },
      feedUrl,
    );

    expect(response.status).toBe(200);
    expect(token.invalidateCount).toBe(1);
    expect(token.readCount).toBe(2);
    expect(scriptedFetch.requests[1]?.headers.get('authorization')).toBe('Bearer fresh-token');
  });

  it('should throw GitHubAuthError naming gh auth login when two answers in a row are 401', async () => {
    const scriptedFetch = new ScriptedFetch([
      new Response('', { status: 401 }),
      new Response('', { status: 401 }),
    ]);
    const token = new FakeGitHubToken(['stale-token', 'still-bad-token']);

    const failure = requestGitHub(
      { fetch: scriptedFetch.fetch, token, timeoutMilliseconds: 1000 },
      feedUrl,
    );

    await expect(failure).rejects.toBeInstanceOf(GitHubAuthError);
    await expect(failure).rejects.toThrow('gh auth login');
    expect(token.invalidateCount).toBe(1);
  });

  it('should throw GitHubRateLimitedError carrying the reset time when a 403 says no requests remain', async () => {
    const resetEpochSeconds = 1_790_000_000;
    const scriptedFetch = new ScriptedFetch([
      new Response('', {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpochSeconds),
        },
      }),
    ]);

    const failure = requestGitHub(
      {
        fetch: scriptedFetch.fetch,
        token: new FakeGitHubToken(['token']),
        timeoutMilliseconds: 1000,
      },
      feedUrl,
    );

    await expect(failure).rejects.toBeInstanceOf(GitHubRateLimitedError);
    await expect(failure).rejects.toMatchObject({ retryAt: new Date(resetEpochSeconds * 1000) });
  });

  it('should throw GitHubRateLimitedError retrying after the retry-after delay when a 429 carries one', async () => {
    const scriptedFetch = new ScriptedFetch([
      new Response('', { status: 429, headers: { 'retry-after': '30' } }),
    ]);
    const earliestRetryAt = Date.now() + 30_000;

    const failure = await requestGitHub(
      {
        fetch: scriptedFetch.fetch,
        token: new FakeGitHubToken(['token']),
        timeoutMilliseconds: 1000,
      },
      feedUrl,
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GitHubRateLimitedError);
    const retryAtMilliseconds = (failure as GitHubRateLimitedError).retryAt.getTime();
    expect(retryAtMilliseconds).toBeGreaterThanOrEqual(earliestRetryAt);
    expect(retryAtMilliseconds).toBeLessThanOrEqual(Date.now() + 30_000);
  });

  it('should throw GitHubRateLimitedError carrying resetAt when a GraphQL answer reports RATE_LIMITED', async () => {
    const resetAt = '2026-09-28T09:00:00Z';
    const scriptedFetch = new ScriptedFetch([
      new Response(
        JSON.stringify({
          errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
          data: { rateLimit: { resetAt } },
        }),
        { status: 200 },
      ),
    ]);

    const failure = requestGitHub(
      {
        fetch: scriptedFetch.fetch,
        token: new FakeGitHubToken(['token']),
        timeoutMilliseconds: 1000,
      },
      'https://api.github.com/graphql',
    );

    await expect(failure).rejects.toBeInstanceOf(GitHubRateLimitedError);
    await expect(failure).rejects.toMatchObject({ retryAt: new Date(resetAt) });
  });

  it('should return the GraphQL response untouched when it reports no rate limit', async () => {
    const body = JSON.stringify({ data: { repository: { issues: { nodes: [] } } } });
    const scriptedFetch = new ScriptedFetch([new Response(body, { status: 200 })]);

    const response = await requestGitHub(
      {
        fetch: scriptedFetch.fetch,
        token: new FakeGitHubToken(['token']),
        timeoutMilliseconds: 1000,
      },
      'https://api.github.com/graphql',
    );

    expect(await response.text()).toBe(body);
  });

  it.each([500, 503, 404, 403])(
    'should throw GitHubRequestError naming the status when GitHub answers %i',
    async (status) => {
      const scriptedFetch = new ScriptedFetch([new Response('', { status })]);

      const failure = requestGitHub(
        {
          fetch: scriptedFetch.fetch,
          token: new FakeGitHubToken(['token']),
          timeoutMilliseconds: 1000,
        },
        feedUrl,
      );

      await expect(failure).rejects.toBeInstanceOf(GitHubRequestError);
      await expect(failure).rejects.toThrow(String(status));
    },
  );

  it('should throw GitHubRequestError when the connection fails', async () => {
    const scriptedFetch = new ScriptedFetch([]);

    const failure = requestGitHub(
      {
        fetch: scriptedFetch.fetch,
        token: new FakeGitHubToken(['token']),
        timeoutMilliseconds: 1000,
      },
      feedUrl,
    );

    await expect(failure).rejects.toBeInstanceOf(GitHubRequestError);
  });

  it('should throw GitHubRequestError when the request never answers within the timeout', async () => {
    const scriptedFetch = new ScriptedFetch(['never-answers']);

    const failure = requestGitHub(
      {
        fetch: scriptedFetch.fetch,
        token: new FakeGitHubToken(['token']),
        timeoutMilliseconds: 20,
      },
      feedUrl,
    );

    await expect(failure).rejects.toBeInstanceOf(GitHubRequestError);
    await expect(failure).rejects.toThrow('timed out');
  });
});
