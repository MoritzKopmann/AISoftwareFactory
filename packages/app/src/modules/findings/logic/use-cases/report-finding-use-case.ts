import type { Clock } from '../../../../shared/clock/clock.js';
import type { Finding, FindingKind } from '../domain/types/finding.js';
import type { FindingRepository } from '../ports/finding-repository.js';

export type ReportFindingRequest = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly runId: string;
  readonly kind: FindingKind;
  readonly location: string;
  readonly summary: string;
};

export type ReportFindingDependencies = {
  readonly findingRepository: FindingRepository;
  readonly clock: Clock;
};

export class ReportFindingUseCase {
  constructor(private readonly dependencies: ReportFindingDependencies) {}

  async execute(request: ReportFindingRequest): Promise<Finding> {
    const { findingRepository, clock } = this.dependencies;
    return findingRepository.insert({ ...request, reportedAt: clock.now() });
  }
}
