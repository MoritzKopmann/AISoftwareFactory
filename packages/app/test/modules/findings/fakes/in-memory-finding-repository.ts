import type { Finding } from '../../../../src/modules/findings/logic/domain/types/finding.js';
import type {
  FindingRepository,
  NewFinding,
} from '../../../../src/modules/findings/logic/ports/finding-repository.js';

export class InMemoryFindingRepository implements FindingRepository {
  private findings: ReadonlyArray<Finding> = [];

  async insert(newFinding: NewFinding): Promise<Finding> {
    const finding: Finding = { ...newFinding, id: this.findings.length + 1, state: 'open' };
    this.findings = [...this.findings, finding];
    return finding;
  }

  async findById(findingId: number): Promise<Finding | undefined> {
    return this.findings.find(({ id }) => id === findingId);
  }

  async list(projectId: string, ticketNumber?: number): Promise<ReadonlyArray<Finding>> {
    return this.findings.filter(
      (finding) =>
        finding.projectId === projectId &&
        (ticketNumber === undefined || finding.ticketNumber === ticketNumber),
    );
  }

  async claimForTicketing(findingId: number): Promise<'claimed' | 'not-open'> {
    return this.replaceWhenOpen(findingId, { state: 'creating' }) ? 'claimed' : 'not-open';
  }

  async releaseClaim(findingId: number): Promise<void> {
    this.replace(findingId, { state: 'open' });
  }

  async markTicketed(
    findingId: number,
    createdTicketNumber: number,
    resolvedAt: string,
  ): Promise<void> {
    this.replace(findingId, { state: 'ticketed', createdTicketNumber, resolvedAt });
  }

  async dismiss(findingId: number, resolvedAt: string): Promise<'dismissed' | 'not-open'> {
    return this.replaceWhenOpen(findingId, { state: 'dismissed', resolvedAt })
      ? 'dismissed'
      : 'not-open';
  }

  private replaceWhenOpen(findingId: number, changes: Partial<Finding>): boolean {
    if (this.findings.find(({ id }) => id === findingId)?.state !== 'open') {
      return false;
    }
    this.replace(findingId, changes);
    return true;
  }

  private replace(findingId: number, changes: Partial<Finding>): void {
    this.findings = this.findings.map((finding) =>
      finding.id === findingId ? { ...finding, ...changes } : finding,
    );
  }
}
