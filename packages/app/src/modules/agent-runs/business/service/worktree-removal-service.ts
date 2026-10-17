import type { Logger } from '../../../../shared/logger/create-logger.js';
import { authoringWorktreePathFor } from '../domain/functions/authoring-worktree-path-for.js';
import { describeError } from '../domain/functions/describe-error.js';
import { worktreePathFor } from '../domain/functions/worktree-path-for.js';
import { WorktreeRemovalFailedError } from '../errors/worktree-removal-failed-error.js';
import type { ProjectPort } from '../port/project/project-port.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { Worktrees } from '../port/worktree/worktrees.js';
import type { RunEndService } from './run-end-service.js';

export type WorktreeRemovalServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly worktrees: Worktrees;
  readonly projectPort: ProjectPort;
  readonly runEndService: Pick<RunEndService, 'finish'>;
  readonly logger: Logger;
  readonly worktreesDirectory: string;
};

/** Removes the worktrees of a closed ticket. Branches and run records stay. */
export class WorktreeRemovalService {
  constructor(private readonly dependencies: WorktreeRemovalServiceDependencies) {}

  async removeForClosedTicket(projectId: string, ticketNumber: number): Promise<void> {
    const { runRepository, worktrees, projectPort, runEndService, logger, worktreesDirectory } =
      this.dependencies;

    const target = await projectPort.find(projectId, ticketNumber);
    if (target === undefined) {
      return;
    }

    const activeRuns = (await runRepository.listActive(projectId)).filter(
      (run) => run.ticketNumber === ticketNumber,
    );
    for (const run of activeRuns) {
      await runEndService.finish(run.id, { kind: 'stopped' });
    }

    const worktreePaths = [
      worktreePathFor(worktreesDirectory, target.repositoryName, ticketNumber),
      authoringWorktreePathFor(worktreesDirectory, target.repositoryName, ticketNumber),
    ];
    for (const worktreePath of worktreePaths) {
      try {
        await worktrees.remove({ checkoutPath: target.checkoutPath, worktreePath });
      } catch (error) {
        if (!(error instanceof WorktreeRemovalFailedError)) {
          throw error;
        }
        logger.error(`Removing worktree ${worktreePath} failed: ${describeError(error)}`);
      }
    }
  }
}
