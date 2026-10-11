import type { RepositoryReference } from '../../../../src/modules/tickets/logic/domain/types/repository-reference.js';
import type { Ticket } from '../../../../src/modules/tickets/logic/domain/types/ticket.js';
import type { TicketSnapshot } from '../../../../src/modules/tickets/logic/domain/types/ticket-snapshot.js';
import type {
  RegisteredRepositories,
  RegisteredRepository,
} from '../../../../src/modules/tickets/logic/ports/registered-repositories.js';
import type { IdeaCreation } from '../../../../src/modules/tickets/logic/ports/idea-creation.js';
import type { IssueFeeds } from '../../../../src/modules/tickets/logic/ports/issue-feeds.js';
import type { GitHubToken } from '../../../../src/modules/tickets/logic/ports/github-token.js';
import type { TicketSource } from '../../../../src/modules/tickets/logic/ports/ticket-source.js';

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

export class FakeRegisteredRepositories implements RegisteredRepositories {
  constructor(private readonly registered: ReadonlyArray<RegisteredRepository>) {}

  async list(): Promise<ReadonlyArray<RegisteredRepository>> {
    return this.registered;
  }
}

export class FakeIssueFeeds implements IssueFeeds {
  readonly requests: RepositoryReference[] = [];
  changed = false;
  failure: Error | undefined;

  async changedSince(repository: RepositoryReference): Promise<boolean> {
    this.requests.push(repository);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.changed;
  }
}

export class FakeTicketSource implements TicketSource {
  readonly snapshotRequests: RepositoryReference[] = [];
  readonly ticketRequests: Array<{ repository: RepositoryReference; number: number }> = [];
  failure: Error | undefined;
  ticketFailure: Error | undefined;
  readonly failuresByRepositoryName = new Map<string, Error>();
  release: Promise<void> | undefined;

  constructor(
    public snapshotToReturn: TicketSnapshot,
    private readonly ticketsByNumber: ReadonlyMap<number, Ticket> = new Map(),
  ) {}

  async snapshot(repository: RepositoryReference): Promise<TicketSnapshot> {
    this.snapshotRequests.push(repository);
    await this.release;
    const failure = this.failuresByRepositoryName.get(repository.name) ?? this.failure;
    if (failure !== undefined) {
      throw failure;
    }
    return this.snapshotToReturn;
  }

  async ticket(repository: RepositoryReference, number: number): Promise<Ticket | undefined> {
    this.ticketRequests.push({ repository, number });
    if (this.ticketFailure !== undefined) {
      throw this.ticketFailure;
    }
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

export class FakeIdeaCreation implements IdeaCreation {
  readonly created: Array<{
    readonly repository: RepositoryReference;
    readonly idea: { readonly title: string; readonly body: string };
  }> = [];
  createdNumber = 12;
  failure: Error | undefined;
  onCreate: () => void = () => undefined;

  async create(
    repository: RepositoryReference,
    idea: { readonly title: string; readonly body: string },
  ): Promise<number> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.created.push({ repository, idea });
    this.onCreate();
    return this.createdNumber;
  }
}
