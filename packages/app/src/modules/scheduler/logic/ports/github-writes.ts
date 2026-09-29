import type { RepositoryReference } from '../domain/types/repository-reference.js';
import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';

export type StatusSwapOutcome =
  | { readonly kind: 'swapped' }
  | { readonly kind: 'mismatch'; readonly actualStatuses: ReadonlyArray<string> };

export interface GitHubWrites {
  readStatus(repository: RepositoryReference, ticketNumber: number): Promise<TicketStatus>;
  transitionStatus(
    repository: RepositoryReference,
    ticketNumber: number,
    allowedFrom: ReadonlyArray<TicketStatus>,
    to: TicketStatus,
  ): Promise<StatusSwapOutcome>;
  comment(repository: RepositoryReference, ticketNumber: number, body: string): Promise<void>;
  rebaseMerge(
    repository: RepositoryReference,
    pullRequestNumber: number,
    headCommit: string,
  ): Promise<void>;
}
