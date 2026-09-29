import type { Clock } from '../../../../shared/clock/clock.js';
import { describeFindingIssue } from '../domain/functions/describe-finding-issue.js';
import type { Finding } from '../domain/types/finding.js';
import { FindingNotFoundError } from '../errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../errors/finding-not-open-error.js';
import type { FindingRepository } from '../ports/finding-repository.js';
import type { GitHubWrites } from '../ports/github-writes.js';
import type { ProjectLookup } from '../ports/project-lookup.js';

export type CreateTicketFromFindingDependencies = {
  readonly findingRepository: FindingRepository;
  readonly gitHubWrites: GitHubWrites;
  readonly projectLookup: ProjectLookup;
  readonly clock: Clock;
};

export class CreateTicketFromFindingUseCase {
  constructor(private readonly dependencies: CreateTicketFromFindingDependencies) {}

  async execute(projectId: string, findingId: number): Promise<Finding> {
    const { findingRepository, gitHubWrites, projectLookup, clock } = this.dependencies;

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

    let createdTicketNumber: number;
    try {
      createdTicketNumber = await gitHubWrites.createIssue(
        project.repository,
        describeFindingIssue(finding),
      );
    } catch (error) {
      await findingRepository.releaseClaim(findingId);
      throw error;
    }

    const resolvedAt = clock.now();
    await findingRepository.markTicketed(findingId, createdTicketNumber, resolvedAt);
    return { ...finding, state: 'ticketed', createdTicketNumber, resolvedAt };
  }
}
