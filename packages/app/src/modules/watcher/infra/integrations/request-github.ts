import { GitHubAuthError } from '../../logic/errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../../logic/errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../../logic/errors/github-request-error.js';
import type { GitHubToken } from './github-token.js';

export type RequestGitHubDependencies = {
  readonly fetch: typeof fetch;
  readonly token: GitHubToken;
  readonly timeoutMilliseconds: number;
};

export async function requestGitHub(
  dependencies: RequestGitHubDependencies,
  url: string,
  headers: Readonly<Record<string, string>> = {},
  body?: string,
): Promise<Response> {
  const response = await sendWithTokenRetry(dependencies, url, headers, body);
  throwIfRateLimited(response);
  if (response.ok && url.endsWith('/graphql')) {
    await throwIfGraphQlRateLimited(response.clone());
  }
  if (!response.ok && response.status !== 304) {
    throw new GitHubRequestError(`GitHub answered ${response.status} for ${url}`);
  }
  return response;
}

async function sendWithTokenRetry(
  dependencies: RequestGitHubDependencies,
  url: string,
  headers: Readonly<Record<string, string>>,
  body: string | undefined,
): Promise<Response> {
  const response = await send(dependencies, url, headers, body);
  if (response.status !== 401) {
    return response;
  }
  dependencies.token.invalidate();
  const retriedResponse = await send(dependencies, url, headers, body);
  if (retriedResponse.status === 401) {
    throw new GitHubAuthError('GitHub rejected the gh token: run gh auth login');
  }
  return retriedResponse;
}

async function send(
  dependencies: RequestGitHubDependencies,
  url: string,
  headers: Readonly<Record<string, string>>,
  body: string | undefined,
): Promise<Response> {
  const token = await dependencies.token.read();
  try {
    return await dependencies.fetch(url, {
      ...(body === undefined ? {} : { method: 'POST', body }),
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(dependencies.timeoutMilliseconds),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new GitHubRequestError(
        `GitHub request timed out after ${dependencies.timeoutMilliseconds} ms: ${url}`,
      );
    }
    throw new GitHubRequestError(`GitHub request failed: ${String(error)}`);
  }
}

type GraphQlAnswer = {
  readonly errors?: ReadonlyArray<{ readonly type?: string }>;
  readonly data?: { readonly rateLimit?: { readonly resetAt?: string } };
};

async function throwIfGraphQlRateLimited(response: Response): Promise<void> {
  let answer: GraphQlAnswer;
  try {
    answer = (await response.json()) as GraphQlAnswer;
  } catch {
    return;
  }
  if (!answer.errors?.some((graphQlError) => graphQlError.type === 'RATE_LIMITED')) {
    return;
  }
  const resetAt = answer.data?.rateLimit?.resetAt;
  const retryAt = resetAt === undefined ? readResetHeader(response) : new Date(resetAt);
  throw new GitHubRateLimitedError('GitHub GraphQL rate limit reached', retryAt);
}

function readResetHeader(response: Response): Date {
  return new Date(Number(response.headers.get('x-ratelimit-reset')) * 1000);
}

function throwIfRateLimited(response: Response): void {
  if (response.status !== 403 && response.status !== 429) {
    return;
  }
  const retryAfterSeconds = response.headers.get('retry-after');
  if (response.headers.get('x-ratelimit-remaining') !== '0' && retryAfterSeconds === null) {
    return;
  }
  const retryAt =
    retryAfterSeconds === null
      ? readResetHeader(response)
      : new Date(Date.now() + Number(retryAfterSeconds) * 1000);
  throw new GitHubRateLimitedError('GitHub rate limit reached', retryAt);
}
