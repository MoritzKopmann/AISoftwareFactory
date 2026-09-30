import type { Clock } from '../../../../shared/clock/clock.js';
import { branchNameFor } from '../domain/functions/branch-name-for.js';
import { describeError } from '../domain/functions/describe-error.js';
import { worktreePathFor } from '../domain/functions/worktree-path-for.js';
import type { FinishRun } from '../domain/types/finish-run.js';
import type { LaunchRunSession } from '../domain/types/launch-run-session.js';
import type { Run } from '../domain/types/run.js';
import type { RunMode } from '../domain/types/run-mode.js';
import type { RunStage } from '../domain/types/run-stage.js';
import { RunTargetNotFoundError } from '../errors/run-target-not-found-error.js';
import type { Identifiers } from '../ports/identifiers.js';
import type { RunRepository } from '../ports/run-repository.js';
import type { RunTargets } from '../ports/run-targets.js';
import type { Worktrees } from '../ports/worktrees.js';

export type StartRunRequest = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly stage: RunStage;
  readonly mode: RunMode;
};

export type StartRunDependencies = {
  readonly runRepository: RunRepository;
  readonly worktrees: Worktrees;
  readonly runTargets: RunTargets;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
  readonly finishRun: FinishRun;
  readonly launchRunSession: LaunchRunSession;
  readonly worktreesDirectory: string;
};

export class StartRunUseCase {
  constructor(private readonly dependencies: StartRunDependencies) {}

  async execute(request: StartRunRequest): Promise<Run> {
    const { runRepository, worktrees, runTargets, identifiers, clock, finishRun } =
      this.dependencies;

    const target = await runTargets.find(request.projectId, request.ticketNumber);
    if (target === undefined) {
      throw new RunTargetNotFoundError(
        `Ticket #${request.ticketNumber} of ${request.projectId} is unknown`,
      );
    }

    const run: Run = {
      id: identifiers.next(),
      projectId: request.projectId,
      ticketNumber: request.ticketNumber,
      stage: request.stage,
      mode: request.mode,
      sessionId: identifiers.next(),
      worktreePath: worktreePathFor(
        this.dependencies.worktreesDirectory,
        target.repositoryName,
        request.ticketNumber,
      ),
      branchName: branchNameFor(request.ticketNumber, target.ticketTitle),
      state: 'running',
      startedAt: clock.now(),
    };
    await runRepository.insert(run);

    try {
      await worktrees.ensure({
        checkoutPath: target.checkoutPath,
        worktreePath: run.worktreePath,
        branchName: run.branchName,
      });
    } catch (error) {
      await finishRun(run.id, { kind: 'crashed', reason: describeError(error) });
      throw error;
    }

    this.dependencies.launchRunSession(run, {
      kind: 'start',
      prompt: `/aisf:implement-ticket ${run.ticketNumber}`,
    });

    return run;
  }
}
