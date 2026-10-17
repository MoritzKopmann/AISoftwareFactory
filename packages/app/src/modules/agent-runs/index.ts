import type { CommandLabeler } from './business/port/label/command-labeler.js';
import type { CommandLabelRepository } from './business/port/repository/command-label-repository.js';
import type { AgentSessions } from './business/port/session/agent-sessions.js';
import type { RunAnswerWaits } from './business/port/repository/run-answer-waits.js';
import type { RunRepository } from './business/port/repository/run-repository.js';
import { CommandLabelService } from './business/service/command-label-service.js';
import { RunAnswerService } from './business/service/run-answer-service.js';
import { RunEndService } from './business/service/run-end-service.js';
import { RunQueryService } from './business/service/run-query-service.js';
import { RunStartService } from './business/service/run-start-service.js';
import type { ProjectPort } from './business/port/project/project-port.js';
import type { SessionFeed } from './business/port/session/session-feed.js';
import type { RunTranscripts } from './business/port/transcript/run-transcripts.js';
import type { Worktrees } from './business/port/worktree/worktrees.js';
import { SqliteCommandLabelRepository } from './infrastructure/repository/sqlite-command-label-repository.js';
import { InMemoryRunAnswerWaits } from './infrastructure/repository/in-memory-run-answer-waits.js';
import { SqliteRunRepository } from './infrastructure/repository/sqlite-run-repository.js';
import { ProjectsAdapter } from './infrastructure/internal/projects-adapter.js';
import { InMemorySessionFeed } from './infrastructure/session/in-memory-session-feed.js';
import { ClaudeAgentSdkCommandLabeler } from './infrastructure/label/claude-agent-sdk-command-labeler.js';
import { ClaudeAgentSdkSessions } from './infrastructure/session/claude-agent-sdk-sessions.js';
import { ClaudeAgentSdkRunTranscripts } from './infrastructure/transcript/claude-agent-sdk-run-transcripts.js';
import { GitCliWorktrees } from './infrastructure/worktree/git-cli-worktrees.js';
import { createAgentRunsRoutes } from './presentation/api/agent-runs-routes.js';
import { createAgentRunsAbortSessionsJob } from './presentation/cron/agent-runs-abort-sessions-job.js';
import { createAgentRunsRecoverInterruptedRunsJob } from './presentation/cron/agent-runs-recover-interrupted-runs-job.js';
import { AgentRunsFacade } from './presentation/internal/agent-runs-facade.js';
import type {
  AgentRunsModule,
  AgentRunsModuleDependencies,
} from './presentation/internal/agent-runs-module.js';
import { createCheckpointTool } from './presentation/tool/create-checkpoint-tool.js';
import { createEscalateTool } from './presentation/tool/create-escalate-tool.js';
import { createParkTool } from './presentation/tool/create-park-tool.js';
import type { ProjectsApi } from '../projects/index.js';

export type { AgentRunsApi } from './presentation/internal/agent-runs-api.js';
export type {
  AgentRunsModule,
  AgentRunsModuleDependencies,
} from './presentation/internal/agent-runs-module.js';
export type { ActiveRunDto } from './presentation/dto/internal/active-run-dto.js';
export type { ActiveWaitDto } from './presentation/dto/internal/active-wait-dto.js';
export type { AnswerRunResultDto } from './presentation/dto/internal/answer-run-result-dto.js';
export type { RunAnswerDto } from './presentation/dto/internal/run-answer-dto.js';
export type { RunDto } from './presentation/dto/internal/run-dto.js';
export type { RunEndingDto, RunWaitDto } from './presentation/dto/internal/run-ending-dto.js';
export type { StartRunRequestDto } from './presentation/dto/internal/start-run-request-dto.js';
export type { StartRunResultDto } from './presentation/dto/internal/start-run-result-dto.js';

type AgentRunsInfrastructure = {
  readonly runRepository: RunRepository;
  readonly agentSessions: AgentSessions;
  readonly worktrees: Worktrees;
  readonly projectPort: ProjectPort;
  readonly runTranscripts: RunTranscripts;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly sessionFeed: SessionFeed;
  readonly commandLabelRepository: CommandLabelRepository;
  readonly commandLabeler: CommandLabeler;
};

const answerTimeoutMarginMilliseconds = 600_000;
const commandLabelTimeoutMilliseconds = 60_000;

export function createAgentRunsModule(
  dependencies: AgentRunsModuleDependencies & { readonly projects: ProjectsApi },
  overrides: Partial<AgentRunsInfrastructure> = {},
): AgentRunsModule {
  const { clock, events } = dependencies;
  const infrastructure: AgentRunsInfrastructure = {
    runRepository: new SqliteRunRepository(dependencies.database),
    agentSessions: new ClaudeAgentSdkSessions({
      claudeExecutablePath: dependencies.claudeExecutablePath,
      pluginDirectory: dependencies.pluginDirectory,
      answerTimeoutMilliseconds:
        dependencies.liveAnswerWindowMilliseconds + answerTimeoutMarginMilliseconds,
    }),
    worktrees: new GitCliWorktrees(),
    projectPort: new ProjectsAdapter(dependencies.projects),
    runTranscripts: new ClaudeAgentSdkRunTranscripts(),
    runAnswerWaits: new InMemoryRunAnswerWaits(),
    sessionFeed: new InMemorySessionFeed(),
    commandLabelRepository: new SqliteCommandLabelRepository(dependencies.database),
    commandLabeler: new ClaudeAgentSdkCommandLabeler({
      claudeExecutablePath: dependencies.claudeExecutablePath,
      timeoutMilliseconds: commandLabelTimeoutMilliseconds,
    }),
    ...overrides,
  };
  const { runRepository, agentSessions, runAnswerWaits } = infrastructure;

  const runEndService = new RunEndService({
    runRepository,
    agentSessions,
    runAnswerWaits,
    clock,
    events,
  });
  const commandLabelService = new CommandLabelService({
    commandLabelRepository: infrastructure.commandLabelRepository,
    commandLabeler: infrastructure.commandLabeler,
  });
  const ownTools = [createEscalateTool(), createParkTool(), createCheckpointTool()];
  const runStartService = new RunStartService({
    runRepository,
    worktrees: infrastructure.worktrees,
    projectPort: infrastructure.projectPort,
    agentSessions,
    runTranscripts: infrastructure.runTranscripts,
    sessionFeed: infrastructure.sessionFeed,
    runAnswerWaits,
    identifiers: dependencies.identifiers,
    clock,
    events,
    logger: dependencies.logger,
    runEndService,
    commandLabelService,
    tools: () => [...ownTools, ...dependencies.agentTools.list()],
    worktreesDirectory: dependencies.worktreesDirectory,
    windowMilliseconds: dependencies.liveAnswerWindowMilliseconds,
  });
  const runAnswerService = new RunAnswerService({ runRepository, runAnswerWaits, runStartService });
  const runQueryService = new RunQueryService({
    runRepository,
    runTranscripts: infrastructure.runTranscripts,
    sessionFeed: infrastructure.sessionFeed,
    commandLabelService,
  });

  return {
    routes: createAgentRunsRoutes({ runEndService, runQueryService }),
    jobs: {
      'agent-runs.recover-interrupted-runs':
        createAgentRunsRecoverInterruptedRunsJob(runEndService),
      'agent-runs.abort-sessions': createAgentRunsAbortSessionsJob(runEndService),
    },
    internal: new AgentRunsFacade({
      runStartService,
      runEndService,
      runAnswerService,
      runQueryService,
    }),
  };
}
