import { buildProjectBoard } from '../domain/functions/build-project-board.js';
import { presentWatch } from '../domain/functions/present-watch.js';
import type { ProjectBoard } from '../domain/types/project-board.js';
import type { ActiveRunLookup } from '../ports/active-run-lookup.js';
import type { WatchStore } from '../ports/watch-store.js';

export type ReadProjectBoardDependencies = {
  readonly activeRunLookup: ActiveRunLookup;
  readonly watchStore: WatchStore;
};

export class ReadProjectBoardUseCase {
  constructor(private readonly dependencies: ReadProjectBoardDependencies) {}

  async execute(projectId: string): Promise<ProjectBoard | undefined> {
    const { activeRunLookup, watchStore } = this.dependencies;
    const watch = watchStore.watch(projectId);
    if (watch === undefined) {
      return undefined;
    }
    const runningTicketNumbers = await activeRunLookup.activeRunTicketNumbers(projectId);
    return {
      ...buildProjectBoard(presentWatch(watch, watchStore.statusWrites(projectId))),
      runningTicketNumbers,
    };
  }
}
