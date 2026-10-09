import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { Finding } from '../domain/types/finding.js';
import { FindingNotFoundError } from '../errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../errors/finding-not-open-error.js';
import type { FindingRepository } from '../ports/finding-repository.js';

export type DismissFindingDependencies = {
  readonly findingRepository: FindingRepository;
  readonly events: EventPublisher;
  readonly clock: Clock;
};

export class DismissFindingUseCase {
  constructor(private readonly dependencies: DismissFindingDependencies) {}

  async execute(projectId: string, findingId: number): Promise<Finding> {
    const { findingRepository, events, clock } = this.dependencies;

    const finding = await findingRepository.findById(findingId);
    if (finding?.projectId !== projectId) {
      throw new FindingNotFoundError(`${projectId} has no finding ${findingId}`);
    }

    const resolvedAt = clock.now();
    const outcome = await findingRepository.dismiss(findingId, resolvedAt);
    if (outcome === 'not-open') {
      throw new FindingNotOpenError(`Finding ${findingId} is already ${finding.state}`);
    }

    events.emit('finding.changed', {
      projectId,
      ticketNumber: finding.ticketNumber,
      findingId,
    });
    return { ...finding, state: 'dismissed', resolvedAt };
  }
}
