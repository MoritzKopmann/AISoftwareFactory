import type { EventPublisher } from '../../shared/bus/event-publisher.js';
import type { Clock } from '../../shared/clock/clock.js';
import type { Logger } from '../../shared/logger/create-logger.js';
import { createEscalateTool } from './api/tools/create-escalate-tool.js';
import { createParkTool } from './api/tools/create-park-tool.js';
import type { Run } from './logic/domain/types/run.js';
import type { RunTool } from './logic/domain/types/run-tool.js';
import { RunAlreadyActiveError } from './logic/errors/run-already-active-error.js';
import { RunNotActiveError } from './logic/errors/run-not-active-error.js';
import { RunTargetNotFoundError } from './logic/errors/run-target-not-found-error.js';
import { WorktreeSetupFailedError } from './logic/errors/worktree-setup-failed-error.js';
import type { AgentSessions } from './logic/ports/agent-sessions.js';
import type { Identifiers } from './logic/ports/identifiers.js';
import type { RecentRunSteps } from './logic/ports/recent-run-steps.js';
import type { RunRepository } from './logic/ports/run-repository.js';
import type { RunTargets } from './logic/ports/run-targets.js';
import type { Worktrees } from './logic/ports/worktrees.js';
import { FinishRunUseCase } from './logic/use-cases/finish-run-use-case.js';
import {
  ReadActiveRunUseCase,
  type ActiveRun,
} from './logic/use-cases/read-active-run-use-case.js';
import { RecoverInterruptedRunsUseCase } from './logic/use-cases/recover-interrupted-runs-use-case.js';
import { SettleRunUseCase } from './logic/use-cases/settle-run-use-case.js';
import { StartRunUseCase, type StartRunRequest } from './logic/use-cases/start-run-use-case.js';
import { StopRunUseCase } from './logic/use-cases/stop-run-use-case.js';

export type { Run } from './logic/domain/types/run.js';
export type { RunContext } from './logic/domain/types/run-context.js';
export type { RunEnding } from './logic/domain/types/run-ending.js';
export type { RunMode } from './logic/domain/types/run-mode.js';
export type { RunStage } from './logic/domain/types/run-stage.js';
export type { RunStep } from './logic/domain/types/run-step.js';
export type { RunTool, RunToolResult } from './logic/domain/types/run-tool.js';
export type { ActiveRun } from './logic/use-cases/read-active-run-use-case.js';
export type { StartRunRequest } from './logic/use-cases/start-run-use-case.js';
export {
  RunAlreadyActiveError,
  RunNotActiveError,
  RunTargetNotFoundError,
  WorktreeSetupFailedError,
};

export type RunnerModuleDependencies = {
  readonly runRepository: RunRepository;
  readonly agentSessions: AgentSessions;
  readonly worktrees: Worktrees;
  readonly runTargets: RunTargets;
  readonly recentRunSteps: RecentRunSteps;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
  readonly events: EventPublisher;
  readonly worktreesDirectory: string;
  readonly appTools: ReadonlyArray<RunTool>;
  readonly logger: Logger;
};

export type RunnerModule = {
  readonly start: (request: StartRunRequest) => Promise<Run>;
  readonly stop: (runId: string) => Promise<void>;
  readonly activeRun: (projectId: string) => Promise<ActiveRun | undefined>;
  readonly settle: (runId: string) => Promise<void>;
  readonly recover: () => Promise<void>;
  readonly abortSessions: () => void;
};

export function createRunnerModule(dependencies: RunnerModuleDependencies): RunnerModule {
  const { runRepository, agentSessions, recentRunSteps, clock, events } = dependencies;

  const finishRun = new FinishRunUseCase({ runRepository, agentSessions, clock, events });
  const startRun = new StartRunUseCase({
    runRepository,
    agentSessions,
    worktrees: dependencies.worktrees,
    runTargets: dependencies.runTargets,
    recentRunSteps,
    identifiers: dependencies.identifiers,
    clock,
    finishRun,
    tools: [createEscalateTool(), createParkTool(), ...dependencies.appTools],
    worktreesDirectory: dependencies.worktreesDirectory,
    logger: dependencies.logger,
  });
  const stopRun = new StopRunUseCase({ runRepository, finishRun });
  const readActiveRun = new ReadActiveRunUseCase({ runRepository, recentRunSteps });
  const settleRun = new SettleRunUseCase({ runRepository, clock });
  const recoverInterruptedRuns = new RecoverInterruptedRunsUseCase({
    runRepository,
    finishRun,
    events,
  });

  return {
    start: (request) => startRun.execute(request),
    stop: (runId) => stopRun.execute(runId),
    activeRun: (projectId) => readActiveRun.execute(projectId),
    settle: (runId) => settleRun.execute(runId),
    recover: () => recoverInterruptedRuns.execute(),
    abortSessions: () => agentSessions.stopAll(),
  };
}
