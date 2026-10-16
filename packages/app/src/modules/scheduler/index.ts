import type { PullRequestMerges } from './business/port/github/pull-request-merges.js';
import { MergeService } from './business/service/merge-service.js';
import { TicketRunService } from './business/service/ticket-run-service.js';
import { GhCliPullRequestMerges } from './infrastructure/github/gh-cli-pull-request-merges.js';
import { ProjectsProjectLookup } from './infrastructure/internal/projects-project-lookup.js';
import { AgentRunsAgentRunControl } from './infrastructure/internal/agent-runs-agent-run-control.js';
import { SkillsRunsGate } from './infrastructure/internal/skills-runs-gate.js';
import { TicketsIdeaCreation } from './infrastructure/internal/tickets-idea-creation.js';
import { TicketsReviewedTicketLookup } from './infrastructure/internal/tickets-reviewed-ticket-lookup.js';
import { TicketsTicketAnswerGate } from './infrastructure/internal/tickets-ticket-answer-gate.js';
import { TicketsTicketLookup } from './infrastructure/internal/tickets-ticket-lookup.js';
import { createSchedulerRoutes } from './presentation/api/scheduler-routes.js';
import { subscribeToSnapshotChanged } from './presentation/bus/subscribe-to-snapshot-changed.js';
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
  const projectLookup = new ProjectsProjectLookup(projects);
  const agentRunControl = new AgentRunsAgentRunControl(agentRuns);

  const ticketRunService = new TicketRunService({
    ticketLookup: new TicketsTicketLookup(tickets),
    agentRunControl,
    runsGate: new SkillsRunsGate(skills),
    projectLookup,
    ideaCreation: new TicketsIdeaCreation(tickets),
    ticketAnswerGate: new TicketsTicketAnswerGate(tickets),
  });
  const mergeService = new MergeService({
    pullRequestMerges: infrastructure.pullRequestMerges,
    agentRunControl,
    reviewedTicketLookup: new TicketsReviewedTicketLookup(tickets),
    projectLookup,
    logger,
  });

  subscribeToSnapshotChanged(events, mergeService, logger);

  return {
    routes: createSchedulerRoutes({ ticketRunService }),
    jobs: {},
    internal: new SchedulerFacade({ ticketRunService }),
  };
}
