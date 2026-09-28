import type { RepositoryReference } from '../../../../src/modules/watcher/logic/domain/types/repository-reference.js';
import type { Ticket } from '../../../../src/modules/watcher/logic/domain/types/ticket.js';
import type { TicketSnapshot } from '../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import type { GitHubToken } from '../../../../src/modules/watcher/logic/ports/github-token.js';
import type { TicketSource } from '../../../../src/modules/watcher/logic/ports/ticket-source.js';

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

export class FakeTicketSource implements TicketSource {
  readonly snapshotRequests: RepositoryReference[] = [];
  readonly ticketRequests: Array<{ repository: RepositoryReference; number: number }> = [];

  constructor(
    private readonly snapshotToReturn: TicketSnapshot,
    private readonly ticketsByNumber: ReadonlyMap<number, Ticket> = new Map(),
  ) {}

  async snapshot(repository: RepositoryReference): Promise<TicketSnapshot> {
    this.snapshotRequests.push(repository);
    return this.snapshotToReturn;
  }

  async ticket(repository: RepositoryReference, number: number): Promise<Ticket | undefined> {
    this.ticketRequests.push({ repository, number });
    return this.ticketsByNumber.get(number);
  }
}

export type RecordedRequest = {
  readonly url: string;
  readonly headers: Headers;
  readonly signal: AbortSignal | undefined;
  readonly method: string | undefined;
  readonly body: string | undefined;
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
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
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
