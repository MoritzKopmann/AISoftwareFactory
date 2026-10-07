import { decidePageStatus } from '../domain/functions/decide-page-status.js';
import { formatPageEvent } from '../domain/functions/format-page-event.js';
import type { PageEvent } from '../domain/types/page-event.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import { PageBusyError } from '../errors/page-busy-error.js';
import { PageClosedError } from '../errors/page-closed-error.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';
import type { CheckpointAnswers } from '../ports/checkpoint-answers.js';
import type { TicketRunLookup } from '../ports/ticket-run-lookup.js';

export type SubmitPageEventDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly ticketRunLookup: TicketRunLookup;
  readonly checkpointAnswers: CheckpointAnswers;
};

export class SubmitPageEventUseCase {
  constructor(private readonly dependencies: SubmitPageEventDependencies) {}

  async execute(token: string, event: PageEvent): Promise<void> {
    const { artifactRepository, ticketRunLookup, checkpointAnswers } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    if (artifact === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    const latestRun = await ticketRunLookup.latest(artifact.projectId, artifact.ticketNumber);
    const status = decidePageStatus(artifact, latestRun);
    if (status === 'busy') {
      throw new PageBusyError('The session is busy');
    }
    if (status === 'closed') {
      throw new PageClosedError('The page is closed');
    }
    await checkpointAnswers.answer(artifact.runId, formatPageEvent(artifact.artifactId, event));
  }
}
