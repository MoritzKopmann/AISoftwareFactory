import type { AgentSessions } from './business/port/session/agent-sessions.js';
import type { RecentRunSteps } from './business/port/repository/recent-run-steps.js';
import type { RunAnswerWaits } from './business/port/repository/run-answer-waits.js';
import type { RunRepository } from './business/port/repository/run-repository.js';
import { RunAnswerService } from './business/service/run-answer-service.js';
import { RunEndService } from './business/service/run-end-service.js';
import { RunQueryService } from './business/service/run-query-service.js';
import { RunStartService } from './business/service/run-start-service.js';
import type { RunTargets } from './business/port/target/run-targets.js';
import type { RunTranscripts } from './business/port/transcript/run-transcripts.js';
import type { Worktrees } from './business/port/worktree/worktrees.js';
import { InMemoryRecentRunSteps } from './infrastructure/repository/in-memory-recent-run-steps.js';
import { InMemoryRunAnswerWaits } from './infrastructure/repository/in-memory-run-answer-waits.js';
import { SqliteRunRepository } from './infrastructure/repository/sqlite-run-repository.js';
import { ProjectsRunTargets } from './infrastructure/internal/projects-run-targets.js';
import { ClaudeAgentSdkSessions } from './infrastructure/session/claude-agent-sdk-sessions.js';
import { ClaudeAgentSdkRunTranscripts } from './infrastructure/transcript/claude-agent-sdk-run-transcripts.js';
import { GitCliWorktrees } from './infrastructure/worktree/git-cli-worktrees.js';
import { createRunnerRoutes } from './presentation/api/runner-routes.js';
import { createRunnerAbortSessionsJob } from './presentation/cron/runner-abort-sessions-job.js';
import { createRunnerRecoverInterruptedRunsJob } from './presentation/cron/runner-recover-interrupted-runs-job.js';
import { RunnerFacade } from './presentation/internal/runner-facade.js';
import type {
  RunnerModule,
  RunnerModuleDependencies,
} from './presentation/internal/runner-module.js';
import { createCheckpointTool } from './presentation/tool/create-checkpoint-tool.js';
import { createEscalateTool } from './presentation/tool/create-escalate-tool.js';
import { createParkTool } from './presentation/tool/create-park-tool.js';
import type { ProjectsApi } from '../projects/index.js';

export type { RunnerApi } from './presentation/internal/runner-api.js';
export type {
  RunnerModule,
  RunnerModuleDependencies,
} from './presentation/internal/runner-module.js';
export type { ActiveRunDto } from './presentation/dto/internal/active-run-dto.js';
export type { ActiveWaitDto } from './presentation/dto/internal/active-wait-dto.js';
export type { AnswerRunResultDto } from './presentation/dto/internal/answer-run-result-dto.js';
export type { RunAnswerDto } from './presentation/dto/internal/run-answer-dto.js';
export type { RunDto } from './presentation/dto/internal/run-dto.js';
export type { RunEndingDto, RunWaitDto } from './presentation/dto/internal/run-ending-dto.js';
export type { RunStepDto } from './presentation/dto/internal/run-step-dto.js';
export type { StartRunRequestDto } from './presentation/dto/internal/start-run-request-dto.js';
export type { StartRunResultDto } from './presentation/dto/internal/start-run-result-dto.js';

type RunnerInfrastructure = {
  readonly runRepository: RunRepository;
  readonly agentSessions: AgentSessions;
  readonly worktrees: Worktrees;
  readonly runTargets: RunTargets;
  readonly recentRunSteps: RecentRunSteps;
  readonly runTranscripts: RunTranscripts;
  readonly runAnswerWaits: RunAnswerWaits;
};

const answerTimeoutMarginMilliseconds = 600_000;

export function createRunnerModule(
  dependencies: RunnerModuleDependencies & { readonly projects: ProjectsApi },
  overrides: Partial<RunnerInfrastructure> = {},
): RunnerModule {
  const { clock, events } = dependencies;
  const infrastructure: RunnerInfrastructure = {
    runRepository: new SqliteRunRepository(dependencies.database),
    agentSessions: new ClaudeAgentSdkSessions({
      claudeExecutablePath: dependencies.claudeExecutablePath,
      pluginDirectory: dependencies.pluginDirectory,
      now: () => clock.now(),
      answerTimeoutMilliseconds:
        dependencies.liveAnswerWindowMilliseconds + answerTimeoutMarginMilliseconds,
    }),
    worktrees: new GitCliWorktrees(),
    runTargets: new ProjectsRunTargets(dependencies.projects),
    recentRunSteps: new InMemoryRecentRunSteps(),
    runTranscripts: new ClaudeAgentSdkRunTranscripts(),
    runAnswerWaits: new InMemoryRunAnswerWaits(),
    ...overrides,
  };
  const { runRepository, agentSessions, recentRunSteps, runAnswerWaits } = infrastructure;

  const runEndService = new RunEndService({
    runRepository,
    agentSessions,
    runAnswerWaits,
    clock,
    events,
  });
  const ownTools = [createEscalateTool(), createParkTool(), createCheckpointTool()];
  const runStartService = new RunStartService({
    runRepository,
    worktrees: infrastructure.worktrees,
    runTargets: infrastructure.runTargets,
    agentSessions,
    recentRunSteps,
    runAnswerWaits,
    identifiers: dependencies.identifiers,
    clock,
    events,
    logger: dependencies.logger,
    runEndService,
    tools: () => [...ownTools, ...dependencies.agentTools.list()],
    worktreesDirectory: dependencies.worktreesDirectory,
    windowMilliseconds: dependencies.liveAnswerWindowMilliseconds,
  });
  const runAnswerService = new RunAnswerService({ runRepository, runAnswerWaits, runStartService });
  const runQueryService = new RunQueryService({
    runRepository,
    recentRunSteps,
    runTranscripts: infrastructure.runTranscripts,
  });

  return {
    routes: createRunnerRoutes({ runEndService, runQueryService }),
    jobs: {
      'runner.recover-interrupted-runs': createRunnerRecoverInterruptedRunsJob(runEndService),
      'runner.abort-sessions': createRunnerAbortSessionsJob(runEndService),
    },
    internal: new RunnerFacade({
      runStartService,
      runEndService,
      runAnswerService,
      runQueryService,
    }),
  };
}
