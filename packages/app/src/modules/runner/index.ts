import { Hono } from 'hono';
import type { EventPublisher } from '../../shared/bus/event-publisher.js';
import type { Clock } from '../../shared/clock/clock.js';
import type { Logger } from '../../shared/logger/create-logger.js';
import { createRunLogRoutes } from './api/routes/create-run-log-routes.js';
import { createStopRunRoutes } from './api/routes/create-stop-run-routes.js';
import { createCheckpointTool } from './api/tools/create-checkpoint-tool.js';
import { createEscalateTool } from './api/tools/create-escalate-tool.js';
import { createParkTool } from './api/tools/create-park-tool.js';
import type { FinishRun } from './logic/domain/types/finish-run.js';
import type { LaunchRunSession } from './logic/domain/types/launch-run-session.js';
import type { RunAnswer } from './logic/domain/types/run-answer.js';
import type { Run } from './logic/domain/types/run.js';
import type { RunTool } from './logic/domain/types/run-tool.js';
import { RunAlreadyActiveError } from './logic/errors/run-already-active-error.js';
import { RunNotActiveError } from './logic/errors/run-not-active-error.js';
import { RunNotResumableError } from './logic/errors/run-not-resumable-error.js';
import { RunTargetNotFoundError } from './logic/errors/run-target-not-found-error.js';
import { WorktreeSetupFailedError } from './logic/errors/worktree-setup-failed-error.js';
import type { AgentSessions } from './logic/ports/agent-sessions.js';
import type { Identifiers } from '../../shared/identifiers/identifiers.js';
import type { RunAnswerWaits } from './logic/ports/run-answer-waits.js';
import type { RecentRunSteps } from './logic/ports/recent-run-steps.js';
import type { RunRepository } from './logic/ports/run-repository.js';
import type { RunTargets } from './logic/ports/run-targets.js';
import type { RunTranscripts } from './logic/ports/run-transcripts.js';
import type { Worktrees } from './logic/ports/worktrees.js';
import { DeliverRunAnswerUseCase } from './logic/use-cases/deliver-run-answer-use-case.js';
import { FinishRunUseCase } from './logic/use-cases/finish-run-use-case.js';
import { LaunchRunSessionUseCase } from './logic/use-cases/launch-run-session-use-case.js';
import {
  ReadActiveRunsUseCase,
  type ActiveRun,
} from './logic/use-cases/read-active-runs-use-case.js';
import { ReadLatestRunUseCase } from './logic/use-cases/read-latest-run-use-case.js';
import { ReadRunUseCase } from './logic/use-cases/read-run-use-case.js';
import { ReadTicketRunLogUseCase } from './logic/use-cases/read-ticket-run-log-use-case.js';
import { RecoverInterruptedRunsUseCase } from './logic/use-cases/recover-interrupted-runs-use-case.js';
import { ResumeRunUseCase } from './logic/use-cases/resume-run-use-case.js';
import { SettleRunUseCase } from './logic/use-cases/settle-run-use-case.js';
import { StartRunUseCase, type StartRunRequest } from './logic/use-cases/start-run-use-case.js';
import { StopRunUseCase } from './logic/use-cases/stop-run-use-case.js';
import { WaitForRunAnswerUseCase } from './logic/use-cases/wait-for-run-answer-use-case.js';

export type { PermissionDecision } from './logic/domain/types/permission-decision.js';
export type { RunAnswer } from './logic/domain/types/run-answer.js';
export type { Run } from './logic/domain/types/run.js';
export type { RunContext } from './logic/domain/types/run-context.js';
export type { RunWait } from './logic/domain/types/run-wait.js';
export type { RunWaitOutcome } from './logic/domain/types/run-wait-outcome.js';
export type { RunEnding } from './logic/domain/types/run-ending.js';
export type { RunMode } from './logic/domain/types/run-mode.js';
export type { RunStage } from './logic/domain/types/run-stage.js';
export type { RunStep } from './logic/domain/types/run-step.js';
export type { RunTool, RunToolResult } from './logic/domain/types/run-tool.js';
export type { ActiveRun } from './logic/use-cases/read-active-runs-use-case.js';
export type { StartRunRequest } from './logic/use-cases/start-run-use-case.js';
export {
  RunAlreadyActiveError,
  RunNotActiveError,
  RunNotResumableError,
  RunTargetNotFoundError,
  WorktreeSetupFailedError,
};

export type RunnerModuleDependencies = {
  readonly runRepository: RunRepository;
  readonly agentSessions: AgentSessions;
  readonly worktrees: Worktrees;
  readonly runTargets: RunTargets;
  readonly recentRunSteps: RecentRunSteps;
  readonly runTranscripts: RunTranscripts;
  readonly identifiers: Identifiers;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly liveAnswerWindowMilliseconds: number;
  readonly clock: Clock;
  readonly events: EventPublisher;
  readonly worktreesDirectory: string;
  readonly appTools: ReadonlyArray<RunTool>;
  readonly logger: Logger;
};

export type RunnerModule = {
  readonly routes: Hono;
  readonly start: (request: StartRunRequest) => Promise<Run>;
  readonly answer: (runId: string, answer: RunAnswer) => Promise<Run>;
  readonly findRun: (runId: string) => Promise<Run | undefined>;
  readonly activeRuns: (projectId: string) => Promise<ReadonlyArray<ActiveRun>>;
  readonly latestRun: (projectId: string, ticketNumber: number) => Promise<Run | undefined>;
  readonly settle: (runId: string) => Promise<void>;
  readonly recover: () => Promise<void>;
  readonly abortSessions: () => void;
};

export function createRunnerModule(dependencies: RunnerModuleDependencies): RunnerModule {
  const { runRepository, agentSessions, recentRunSteps, runAnswerWaits, clock, events } =
    dependencies;

  const finishRunUseCase = new FinishRunUseCase({
    runRepository,
    agentSessions,
    runAnswerWaits,
    clock,
    events,
  });
  const finishRun: FinishRun = (runId, ending) => finishRunUseCase.execute(runId, ending);
  const waitForRunAnswer = new WaitForRunAnswerUseCase({
    runRepository,
    runAnswerWaits,
    clock,
    events,
    finishRun,
    windowMilliseconds: dependencies.liveAnswerWindowMilliseconds,
  });
  const launchRunSessionUseCase = new LaunchRunSessionUseCase({
    agentSessions,
    recentRunSteps,
    runRepository,
    finishRun,
    waitForRunAnswer: (run, wait) => waitForRunAnswer.execute(run, wait),
    tools: [
      createEscalateTool(),
      createParkTool(),
      createCheckpointTool(),
      ...dependencies.appTools,
    ],
    logger: dependencies.logger,
  });
  const launchRunSession: LaunchRunSession = (run, launch) =>
    launchRunSessionUseCase.execute(run, launch);
  const startRun = new StartRunUseCase({
    runRepository,
    worktrees: dependencies.worktrees,
    runTargets: dependencies.runTargets,
    identifiers: dependencies.identifiers,
    clock,
    finishRun,
    launchRunSession,
    worktreesDirectory: dependencies.worktreesDirectory,
  });
  const resumeRun = new ResumeRunUseCase({
    runRepository,
    identifiers: dependencies.identifiers,
    clock,
    launchRunSession,
  });
  const deliverRunAnswer = new DeliverRunAnswerUseCase({
    runRepository,
    runAnswerWaits,
    resumeRun: (runId, answer) => resumeRun.execute(runId, answer),
  });
  const readRun = new ReadRunUseCase({ runRepository });
  const stopRun = new StopRunUseCase({ runRepository, finishRun });
  const readActiveRuns = new ReadActiveRunsUseCase({ runRepository, recentRunSteps });
  const readLatestRun = new ReadLatestRunUseCase({ runRepository });
  const readTicketRunLog = new ReadTicketRunLogUseCase({
    runRepository,
    runTranscripts: dependencies.runTranscripts,
  });
  const settleRun = new SettleRunUseCase({ runRepository, clock });
  const recoverInterruptedRuns = new RecoverInterruptedRunsUseCase({
    runRepository,
    finishRun,
    events,
  });

  return {
    routes: new Hono()
      .route('/runs', createStopRunRoutes(stopRun))
      .route('/projects', createRunLogRoutes(readTicketRunLog)),
    start: (request) => startRun.execute(request),
    answer: (runId, answer) => deliverRunAnswer.execute(runId, answer),
    findRun: (runId) => readRun.execute(runId),
    activeRuns: (projectId) => readActiveRuns.execute(projectId),
    latestRun: (projectId, ticketNumber) => readLatestRun.execute(projectId, ticketNumber),
    settle: (runId) => settleRun.execute(runId),
    recover: () => recoverInterruptedRuns.execute(),
    abortSessions: () => agentSessions.stopAll(),
  };
}
