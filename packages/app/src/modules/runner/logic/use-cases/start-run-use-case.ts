import type { Clock } from '../../../../shared/clock/clock.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import { stageModels } from '../domain/constants/stage-models.js';
import { branchNameFor } from '../domain/functions/branch-name-for.js';
import { worktreePathFor } from '../domain/functions/worktree-path-for.js';
import type { Run } from '../domain/types/run.js';
import type { RunContext } from '../domain/types/run-context.js';
import type { RunMode } from '../domain/types/run-mode.js';
import type { RunStage } from '../domain/types/run-stage.js';
import type { RunTool } from '../domain/types/run-tool.js';
import type { SessionEvent } from '../domain/types/session-event.js';
import type { SessionTool } from '../domain/types/session-tool.js';
import { RunTargetNotFoundError } from '../errors/run-target-not-found-error.js';
import type { AgentSessions } from '../ports/agent-sessions.js';
import type { Identifiers } from '../ports/identifiers.js';
import type { RecentRunSteps } from '../ports/recent-run-steps.js';
import type { RunRepository } from '../ports/run-repository.js';
import type { RunTargets } from '../ports/run-targets.js';
import type { Worktrees } from '../ports/worktrees.js';
import type { RunFinisher } from '../ports/run-finisher.js';

export type StartRunRequest = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly stage: RunStage;
  readonly mode: RunMode;
};

export type StartRunDependencies = {
  readonly runRepository: RunRepository;
  readonly agentSessions: AgentSessions;
  readonly worktrees: Worktrees;
  readonly runTargets: RunTargets;
  readonly recentRunSteps: RecentRunSteps;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
  readonly finishRun: RunFinisher;
  readonly tools: ReadonlyArray<RunTool>;
  readonly worktreesDirectory: string;
  readonly logger: Logger;
};

export class StartRunUseCase {
  constructor(private readonly dependencies: StartRunDependencies) {}

  async execute(request: StartRunRequest): Promise<Run> {
    const { runRepository, agentSessions, worktrees, runTargets, identifiers, clock, finishRun } =
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
      await finishRun.finish(run.id, { kind: 'crashed', reason: describeError(error) });
      throw error;
    }

    const sessionEvents = agentSessions.start({
      sessionId: run.sessionId,
      worktreePath: run.worktreePath,
      prompt: `/aisf:implement-ticket ${run.ticketNumber}`,
      model: stageModels[run.stage],
      tools: this.bindTools({
        runId: run.id,
        projectId: run.projectId,
        ticketNumber: run.ticketNumber,
        worktreePath: run.worktreePath,
      }),
    });
    this.consume(run, sessionEvents).catch((error: unknown) => {
      this.reportFailure(run, error);
    });

    return run;
  }

  private bindTools(runContext: RunContext): ReadonlyArray<SessionTool> {
    return this.dependencies.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputShape: tool.inputShape,
      execute: async (input) => {
        const result = await tool.execute(input, runContext);
        if (result.ending !== undefined) {
          await this.dependencies.finishRun.finish(runContext.runId, result.ending);
        }
        return result.text;
      },
    }));
  }

  private async consume(run: Run, sessionEvents: AsyncIterable<SessionEvent>): Promise<void> {
    const { finishRun, recentRunSteps } = this.dependencies;
    try {
      for await (const event of sessionEvents) {
        switch (event.kind) {
          case 'step':
            recentRunSteps.append(run.id, event.step);
            break;
          case 'completed':
            await finishRun.finish(run.id, { kind: 'finished' });
            break;
          case 'permission-needed':
            await finishRun.finish(run.id, {
              kind: 'permission-needed',
              toolName: event.toolName,
              toolInput: event.toolInput,
            });
            break;
          case 'usage-limit':
            await finishRun.finish(run.id, { kind: 'usage-limit', reason: event.reason });
            break;
          case 'crashed':
            await finishRun.finish(run.id, { kind: 'crashed', reason: event.reason });
            break;
        }
      }
    } catch (error) {
      // A session that throws must still end its run.
      this.reportFailure(run, error);
      await finishRun.finish(run.id, { kind: 'crashed', reason: describeError(error) });
    }
  }

  private reportFailure(run: Run, error: unknown): void {
    this.dependencies.logger.error(`Run ${run.id} failed: ${describeError(error)}`);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
