import { deriveTicketStatus } from '../../logic/domain/functions/derive-ticket-status.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import type { Ticket } from '../../logic/domain/types/ticket.js';
import type { TicketSnapshot } from '../../logic/domain/types/ticket-snapshot.js';
import { GitHubRequestError } from '../../logic/errors/github-request-error.js';
import type { GitHubToken } from '../../logic/ports/github-token.js';
import type { TicketSource } from '../../logic/ports/ticket-source.js';
import { requestGitHub } from './request-github.js';

const graphQlUrl = 'https://api.github.com/graphql';
const requestTimeoutMilliseconds = 30_000;

const ticketFields = `
  number
  title
  url
  updatedAt
  labels(first: 20) { nodes { name } }
  parent { number title }
  subIssues(first: 100) { nodes { number } }
  blockedBy(first: 20) { nodes { number state repository { nameWithOwner } } }
  closedByPullRequestsReferences(first: 5, includeClosedPrs: true) { nodes { number url state } }
`;

const openTicketsQuery = `
  query ($owner: String!, $name: String!, $after: String) {
    rateLimit { resetAt }
    repository(owner: $owner, name: $name) {
      issues(states: OPEN, first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ticketFields} }
      }
    }
  }
`;

const closedTicketsQuery = `
  query ($owner: String!, $name: String!) {
    rateLimit { resetAt }
    repository(owner: $owner, name: $name) {
      issues(states: CLOSED, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
        totalCount
        nodes { ${ticketFields} }
      }
    }
  }
`;

const ticketQuery = `
  query ($owner: String!, $name: String!, $number: Int!) {
    rateLimit { resetAt }
    repository(owner: $owner, name: $name) {
      issueOrPullRequest(number: $number) {
        __typename
        ... on Issue {
          state
          ${ticketFields}
        }
      }
    }
  }
`;

type IssueNode = {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly updatedAt: string;
  readonly labels: { readonly nodes: ReadonlyArray<{ readonly name: string }> };
  readonly parent: { readonly number: number; readonly title: string } | null;
  readonly subIssues: { readonly nodes: ReadonlyArray<{ readonly number: number }> };
  readonly blockedBy: {
    readonly nodes: ReadonlyArray<{
      readonly number: number;
      readonly state: string;
      readonly repository: { readonly nameWithOwner: string };
    }>;
  };
  readonly closedByPullRequestsReferences: {
    readonly nodes: ReadonlyArray<{
      readonly number: number;
      readonly url: string;
      readonly state: string;
    }>;
  };
};

type OpenTicketsAnswer = {
  readonly data: {
    readonly repository: {
      readonly issues: {
        readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
        readonly nodes: ReadonlyArray<IssueNode>;
      };
    };
  };
};

type ClosedTicketsAnswer = {
  readonly data: {
    readonly repository: {
      readonly issues: {
        readonly totalCount: number;
        readonly nodes: ReadonlyArray<IssueNode>;
      };
    };
  };
};

type TicketAnswer = {
  readonly data: {
    readonly repository: {
      readonly issueOrPullRequest:
        | (IssueNode & { readonly __typename: 'Issue'; readonly state: string })
        | { readonly __typename: 'PullRequest' }
        | null;
    };
  };
};

export type FetchGraphQLTicketSourceDependencies = {
  readonly fetch: typeof fetch;
  readonly token: GitHubToken;
  readonly now: () => Date;
};

export class FetchGraphQLTicketSource implements TicketSource {
  constructor(private readonly dependencies: FetchGraphQLTicketSourceDependencies) {}

  async snapshot(repository: RepositoryReference): Promise<TicketSnapshot> {
    const openTickets: Ticket[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await this.query<OpenTicketsAnswer>(openTicketsQuery, {
        ...repositoryVariables(repository),
        after,
      });
      const { pageInfo, nodes } = page.data.repository.issues;
      openTickets.push(...nodes.map((node) => toTicket(node, 'open')));
      if (!pageInfo.hasNextPage || pageInfo.endCursor === null) {
        break;
      }
      after = pageInfo.endCursor;
    }

    const closed = await this.query<ClosedTicketsAnswer>(
      closedTicketsQuery,
      repositoryVariables(repository),
    );
    const { totalCount, nodes } = closed.data.repository.issues;
    return {
      takenAt: this.dependencies.now().toISOString(),
      openTickets,
      recentlyClosedTickets: nodes.map((node) => toTicket(node, 'closed')),
      closedTotalCount: totalCount,
    };
  }

  async ticket(repository: RepositoryReference, number: number): Promise<Ticket | undefined> {
    const answer = await this.query<TicketAnswer>(ticketQuery, {
      ...repositoryVariables(repository),
      number,
    });
    const found = answer.data.repository.issueOrPullRequest;
    if (found === null || found.__typename !== 'Issue') {
      return undefined;
    }
    return toTicket(found, found.state === 'CLOSED' ? 'closed' : 'open');
  }

  private async query<Answer>(
    query: string,
    variables: Readonly<Record<string, unknown>>,
  ): Promise<Answer> {
    const response = await requestGitHub(
      { ...this.dependencies, timeoutMilliseconds: requestTimeoutMilliseconds },
      graphQlUrl,
      {},
      JSON.stringify({ query, variables }),
    );
    const answer = (await response.json()) as GraphQlEnvelope & Answer;
    if (answer.data?.repository == null) {
      const message = answer.errors?.[0]?.message ?? 'no repository in the answer';
      throw new GitHubRequestError(`GitHub GraphQL query failed: ${message}`);
    }
    return answer;
  }
}

type GraphQlEnvelope = {
  readonly data?: { readonly repository?: unknown } | null;
  readonly errors?: ReadonlyArray<{ readonly message?: string }>;
};

function repositoryVariables(repository: RepositoryReference): { owner: string; name: string } {
  return { owner: repository.owner, name: repository.name };
}

function toTicket(node: IssueNode, state: 'open' | 'closed'): Ticket {
  const labelNames = node.labels.nodes.map((label) => label.name);
  const { status, conflictingStatuses } = deriveTicketStatus({ state, labelNames });
  return {
    number: node.number,
    title: node.title,
    url: node.url,
    status,
    conflictingStatuses,
    hitl: labelNames.includes('hitl'),
    ...(node.parent === null ? {} : { parent: node.parent }),
    subIssueNumbers: node.subIssues.nodes.map((subIssue) => subIssue.number),
    blockedBy: node.blockedBy.nodes.map((blocker) => ({
      repository: blocker.repository.nameWithOwner,
      number: blocker.number,
      open: blocker.state === 'OPEN',
    })),
    closingPullRequests: node.closedByPullRequestsReferences.nodes.map((pullRequest) => ({
      number: pullRequest.number,
      url: pullRequest.url,
      state: pullRequest.state,
    })),
    updatedAt: node.updatedAt,
  };
}
