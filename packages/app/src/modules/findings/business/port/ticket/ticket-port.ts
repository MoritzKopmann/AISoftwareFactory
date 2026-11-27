import type { FindingIssue } from '../../domain/types/finding-issue.js';
import type { RepositoryReference } from '../../domain/types/repository-reference.js';

export interface TicketPort {
  create(repository: RepositoryReference, issue: FindingIssue): Promise<number>;
}
