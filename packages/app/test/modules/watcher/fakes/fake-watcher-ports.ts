import type { GitHubToken } from '../../../../src/modules/watcher/logic/ports/github-token.js';

export class FakeGitHubToken implements GitHubToken {
  readCount = 0;
  invalidateCount = 0;

  constructor(private readonly tokens: ReadonlyArray<string>) {}

  async read(): Promise<string> {
    const token = this.tokens[Math.min(this.invalidateCount, this.tokens.length - 1)];
    this.readCount += 1;
    return token ?? '';
  }

  invalidate(): void {
    this.invalidateCount += 1;
  }
}

export type RecordedRequest = {
  readonly url: string;
  readonly headers: Headers;
  readonly signal: AbortSignal | undefined;
};

export type ScriptedAnswer = Response | 'never-answers';

export class ScriptedFetch {
  readonly requests: RecordedRequest[] = [];

  constructor(private readonly answers: ReadonlyArray<ScriptedAnswer>) {}

  readonly fetch: typeof fetch = (input, init) => {
    const signal = init?.signal ?? undefined;
    this.requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      signal,
    });
    const answer = this.answers[this.requests.length - 1];
    if (answer === undefined) {
      return Promise.reject(new Error('no scripted answer left'));
    }
    if (answer === 'never-answers') {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
    }
    return Promise.resolve(answer);
  };
}
