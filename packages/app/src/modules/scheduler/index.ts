import type { PullRequestMerges } from './business/port/github/pull-request-merges.js';
import { MergeService } from './business/service/merge-service.js';
import { TicketRunService } from './business/service/ticket-run-service.js';
import { GhCliPullRequestMerges } from './infrastructure/github/gh-cli-pull-request-merges.js';
import { AgentRunsAdapter } from './infrastructure/internal/agent-runs-adapter.js';
import { ProjectsAdapter } from './infrastructure/internal/projects-adapter.js';
import { SkillsAdapter } from './infrastructure/internal/skills-adapter.js';
import { TicketsAdapter } from './infrastructure/internal/tickets-adapter.js';
import { createSchedulerRoutes } from './presentation/api/scheduler-routes.js';
import { subscribeToSnapshotChanged } from './presentation/bus/subscribe-to-snapshot-changed.js';
import { subscribeToWatchUpdated } from './presentation/bus/subscribe-to-watch-updated.js';
import { SchedulerFacade } from './presentation/internal/scheduler-facade.js';
import type {
  SchedulerModule,
  SchedulerModuleDependencies,
} from './presentation/internal/scheduler-module.js';
import type { ProjectsApi } from '../projects/index.js';
import type { AgentRunsApi } from '../agent-runs/index.js';
import type { SkillsApi } from '../skills/index.js';
import type { TicketsApi } from '../tickets/index.js';

export type { SchedulerApi } from './presentation/internal/scheduler-api.js';
export type {
  SchedulerModule,
  SchedulerModuleDependencies,
} from './presentation/internal/scheduler-module.js';
export type { RunAnswerDto } from './presentation/dto/internal/run-answer-dto.js';
export type { StartedRunDto } from './presentation/dto/internal/started-run-dto.js';

type SchedulerInfrastructure = {
  readonly pullRequestMerges: PullRequestMerges;
};

export function createSchedulerModule(
  dependencies: SchedulerModuleDependencies & {
    readonly projects: Pick<ProjectsApi, 'list'>;
    readonly skills: Pick<SkillsApi, 'runsBlocked'>;
    readonly tickets: Pick<
      TicketsApi,
      'ticket' | 'openTickets' | 'beginAnswer' | 'revertAnswer' | 'createIdea'
    >;
    readonly agentRuns: Pick<
      AgentRunsApi,
      'start' | 'answer' | 'findRun' | 'activeRuns' | 'latestRun'
    >;
  },
  overrides: Partial<SchedulerInfrastructure> = {},
): SchedulerModule {
  const { events, logger, projects, skills, tickets, agentRuns } = dependencies;
  const infrastructure: SchedulerInfrastructure = {
    pullRequestMerges: new GhCliPullRequestMerges(),
    ...overrides,
  };
  const projectPort = new ProjectsAdapter(projects);
  const runPort = new AgentRunsAdapter(agentRuns);
  const ticketPort = new TicketsAdapter(tickets);

  const ticketRunService = new TicketRunService({
    ticketPort,
    runPort,
    skillPort: new SkillsAdapter(skills),
    projectPort,
    logger,
  });
  const mergeService = new MergeService({
    pullRequestMerges: infrastructure.pullRequestMerges,
    runPort,
    ticketPort,
    projectPort,
    logger,
  });

  subscribeToSnapshotChanged(events, mergeService, logger);
  subscribeToWatchUpdated(events, ticketRunService, logger);

  return {
    routes: createSchedulerRoutes({ ticketRunService }),
    jobs: {},
    internal: new SchedulerFacade({ ticketRunService }),
  };
}
