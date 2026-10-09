import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
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
  readonly events: EventPublisher;
  readonly clock: Clock;
};

export class ReportFindingUseCase {
  constructor(private readonly dependencies: ReportFindingDependencies) {}

  async execute(request: ReportFindingRequest): Promise<Finding> {
    const { findingRepository, events, clock } = this.dependencies;
    const finding = await findingRepository.insert({ ...request, reportedAt: clock.now() });
    events.emit('finding.changed', {
      projectId: finding.projectId,
      ticketNumber: finding.ticketNumber,
      findingId: finding.id,
    });
    return finding;
  }
}
