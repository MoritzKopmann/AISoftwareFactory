import { buildProjectBoard } from '../domain/functions/build-project-board.js';
import type { ProjectBoard } from '../domain/types/project-board.js';
import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { ActiveRunLookup } from '../ports/active-run-lookup.js';

export type ReadProjectBoardDependencies = {
  readonly activeRunLookup: ActiveRunLookup;
};

export class ReadProjectBoardUseCase {
  constructor(private readonly dependencies: ReadProjectBoardDependencies) {}

  async execute(watch: RepositoryWatch): Promise<ProjectBoard> {
    const runningTicketNumber = await this.dependencies.activeRunLookup.activeRunTicketNumber(
      watch.projectId,
    );
    return {
      ...buildProjectBoard(watch),
      ...(runningTicketNumber === undefined ? {} : { runningTicketNumber }),
    };
  }
}
