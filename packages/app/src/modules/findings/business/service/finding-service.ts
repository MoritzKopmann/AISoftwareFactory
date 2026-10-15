import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import { describeFindingIssue } from '../domain/functions/describe-finding-issue.js';
import type { Finding, FindingKind } from '../domain/types/finding.js';
import { FindingNotFoundError } from '../errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../errors/finding-not-open-error.js';
import type { ProjectLookup } from '../port/project/project-lookup.js';
import type { FindingRepository } from '../port/repository/finding-repository.js';
import type { TicketCreator } from '../port/ticket/ticket-creator.js';

export type ReportFindingRequest = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly runId: string;
  readonly kind: FindingKind;
  readonly location: string;
  readonly summary: string;
};

export type FindingServiceDependencies = {
  readonly findingRepository: FindingRepository;
  readonly ticketCreator: TicketCreator;
  readonly projectLookup: ProjectLookup;
  readonly events: EventPublisher;
  readonly clock: Clock;
};

export class FindingService {
  constructor(private readonly dependencies: FindingServiceDependencies) {}

  async report(request: ReportFindingRequest): Promise<Finding> {
    const { findingRepository, events, clock } = this.dependencies;
    const finding = await findingRepository.insert({ ...request, reportedAt: clock.now() });
    events.emit('finding.changed', {
      projectId: finding.projectId,
      ticketNumber: finding.ticketNumber,
      findingId: finding.id,
    });
    return finding;
  }

  async list(projectId: string, ticketNumber?: number): Promise<ReadonlyArray<Finding>> {
    return this.dependencies.findingRepository.list(projectId, ticketNumber);
  }

  async dismiss(projectId: string, findingId: number): Promise<Finding> {
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

  async createTicket(projectId: string, findingId: number): Promise<Finding> {
    const { findingRepository, ticketCreator, projectLookup, events, clock } = this.dependencies;

    const finding = await findingRepository.findById(findingId);
    if (finding?.projectId !== projectId) {
      throw new FindingNotFoundError(`${projectId} has no finding ${findingId}`);
    }
    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      throw new FindingNotFoundError(`${projectId} is not a known project`);
    }

    if ((await findingRepository.claimForTicketing(findingId)) === 'not-open') {
      throw new FindingNotOpenError(`Finding ${findingId} is not open`);
    }

    const announce = (): void =>
      events.emit('finding.changed', {
        projectId,
        ticketNumber: finding.ticketNumber,
        findingId,
      });
    announce();

    let createdTicketNumber: number;
    try {
      createdTicketNumber = await ticketCreator.create(
        project.repository,
        describeFindingIssue(finding),
      );
    } catch (error) {
      await findingRepository.releaseClaim(findingId);
      announce();
      throw error;
    }

    const resolvedAt = clock.now();
    await findingRepository.markTicketed(findingId, createdTicketNumber, resolvedAt);
    announce();
    return { ...finding, state: 'ticketed', createdTicketNumber, resolvedAt };
  }
}
