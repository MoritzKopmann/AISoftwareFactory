import { IdeaRunNotStartedError } from '../errors/idea-run-not-started-error.js';
import { ProjectNotFoundError } from '../errors/project-not-found-error.js';
import { RunAlreadyActiveError } from '../errors/run-already-active-error.js';
import { RunNotAvailableError } from '../errors/run-not-available-error.js';
import type { StartedRun } from '../domain/types/started-run.js';
import type { IdeaCreation } from '../ports/idea-creation.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { RunsGate } from '../ports/runs-gate.js';

export type StartIdeaSessionDependencies = {
  readonly projectLookup: ProjectLookup;
  readonly runsGate: RunsGate;
  readonly ideaCreation: IdeaCreation;
  readonly startTicketRun: (projectId: string, ticketNumber: number) => Promise<StartedRun>;
};

export class StartIdeaSessionUseCase {
  constructor(private readonly dependencies: StartIdeaSessionDependencies) {}

  async execute(projectId: string, title: string): Promise<number> {
    const { projectLookup, runsGate, ideaCreation, startTicketRun } = this.dependencies;

    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      throw new ProjectNotFoundError(`Project ${projectId} is not registered`);
    }
    if (!project.onboarded) {
      throw new RunNotAvailableError('The project is not onboarded');
    }
    const runsBlocked = runsGate.check();
    if (runsBlocked.blocked) {
      throw new RunNotAvailableError(runsBlocked.reason);
    }

    const ticketNumber = await ideaCreation.create(project.repository, { title, body: '' });
    try {
      await startTicketRun(projectId, ticketNumber);
    } catch (error) {
      if (error instanceof RunNotAvailableError || error instanceof RunAlreadyActiveError) {
        throw new IdeaRunNotStartedError(ticketNumber, error.message);
      }
      throw error;
    }
    return ticketNumber;
  }
}
