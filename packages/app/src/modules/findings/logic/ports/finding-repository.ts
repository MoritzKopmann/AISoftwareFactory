import type { Finding } from '../domain/types/finding.js';

export type NewFinding = Pick<
  Finding,
  'projectId' | 'ticketNumber' | 'runId' | 'kind' | 'location' | 'summary' | 'reportedAt'
>;

export interface FindingRepository {
  insert(newFinding: NewFinding): Promise<Finding>;
  findById(findingId: number): Promise<Finding | undefined>;
  list(projectId: string, ticketNumber?: number): Promise<ReadonlyArray<Finding>>;
  claimForTicketing(findingId: number): Promise<'claimed' | 'not-open'>;
  releaseClaim(findingId: number): Promise<void>;
  markTicketed(findingId: number, createdTicketNumber: number, resolvedAt: string): Promise<void>;
  dismiss(findingId: number, resolvedAt: string): Promise<'dismissed' | 'not-open'>;
}
