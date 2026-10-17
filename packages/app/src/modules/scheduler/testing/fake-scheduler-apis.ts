import type { ProjectsApi } from '../../projects/index.js';
import type {
  ActiveRunDto,
  AnswerRunResultDto,
  RunAnswerDto,
  RunDto,
  AgentRunsApi,
  StartRunRequestDto,
  StartRunResultDto,
} from '../../agent-runs/index.js';
import type { SkillsApi } from '../../skills/index.js';
import type { TicketDto, TicketsApi } from '../../tickets/index.js';

export function buildRunDto(overrides: Partial<RunDto> = {}): RunDto {
  return {
    id: 'run-1',
    projectId: 'moritz/aisf',
    ticketNumber: 138,
    stage: 'implement',
    mode: 'afk',
    sessionId: 'session-1',
    worktreePath: '/worktree',
    branchName: 'aisf/138-add-login',
    state: 'running',
    startedAt: '2026-09-29T09:00:00.000Z',
    ...overrides,
  };
}

export function buildTicketDto(overrides: Partial<TicketDto> = {}): TicketDto {
  return {
    number: 138,
    title: 'Add login',
    url: 'https://github.com/moritz/aisf/issues/138',
    body: '',
    status: 'ready',
    conflictingStatuses: [],
    hitl: false,
    waiting: false,
    stuck: false,
    types: [],
    subIssueNumbers: [],
    blockedBy: [],
    closingPullRequests: [],
    updatedAt: '2026-09-29T08:00:00.000Z',
    ...overrides,
  };
}

export function fakeProjectsApi(): Pick<ProjectsApi, 'list'> {
  return {
    list: async () => [
      {
        id: 'moritz/aisf',
        repository: { owner: 'moritz', name: 'aisf' },
        checkoutPath: '/checkout',
        addedAt: '2026-09-29T08:00:00.000Z',
        paused: false,
        contract: { passed: true, missingSlots: [], missingKeys: [] },
      },
    ],
  };
}

export function fakeSkillsApi(): Pick<SkillsApi, 'runsBlocked'> {
  return { runsBlocked: () => ({ blocked: false }) };
}

export class FakeTicketsApi implements Pick<
  TicketsApi,
  'ticket' | 'openTickets' | 'beginAnswer' | 'revertAnswer' | 'createIdea'
> {
  readonly calls: string[] = [];
  openTicketDtos: ReadonlyArray<TicketDto> = [];
  beginFailure: Error | undefined;

  constructor(private readonly ticketDto: TicketDto | undefined = buildTicketDto()) {}

  async ticket(_projectId: string, number: number) {
    return this.ticketDto === undefined || this.ticketDto.number !== number
      ? undefined
      : {
          projectId: 'moritz/aisf',
          sync: {
            state: 'ok' as const,
            checkedAt: '2026-09-29T10:00:00.000Z',
            snapshotTakenAt: '2026-09-29T10:00:00.000Z',
          },
          ticket: this.ticketDto,
        };
  }

  openTickets(): ReadonlyArray<TicketDto> {
    return this.openTicketDtos;
  }

  async beginAnswer(projectId: string, ticketNumber: number): Promise<void> {
    this.calls.push(`begin ${projectId} #${ticketNumber}`);
    if (this.beginFailure !== undefined) {
      throw this.beginFailure;
    }
  }

  async revertAnswer(projectId: string, ticketNumber: number): Promise<void> {
    this.calls.push(`revert ${projectId} #${ticketNumber}`);
  }

  async createIdea(
    _repository: { readonly owner: string; readonly name: string },
    idea: { readonly title: string; readonly body: string },
  ): Promise<number> {
    this.calls.push(`create ${JSON.stringify(idea)}`);
    return 501;
  }
}

export class FakeAgentRunsApi implements Pick<
  AgentRunsApi,
  'start' | 'answer' | 'findRun' | 'activeRuns' | 'latestRun'
> {
  readonly calls: string[] = [];
  activeTicketNumbers: ReadonlyArray<number> = [];
  record: RunDto | undefined;
  latest: RunDto | undefined;
  startResult: StartRunResultDto = { kind: 'started', run: buildRunDto() };
  answerResult: AnswerRunResultDto = {
    kind: 'answered',
    run: buildRunDto({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' }),
  };

  async start(request: StartRunRequestDto): Promise<StartRunResultDto> {
    this.calls.push(`start ${request.projectId} #${request.ticketNumber}`);
    return this.startResult;
  }

  async answer(runId: string, answer: RunAnswerDto): Promise<AnswerRunResultDto> {
    this.calls.push(`answer ${runId} ${JSON.stringify(answer)}`);
    return this.answerResult;
  }

  async findRun(): Promise<RunDto | undefined> {
    return this.record;
  }

  async activeRuns(): Promise<ReadonlyArray<ActiveRunDto>> {
    return this.activeTicketNumbers.map((ticketNumber) => ({
      run: buildRunDto({ ticketNumber }),
    }));
  }

  async latestRun(): Promise<RunDto | undefined> {
    return this.latest;
  }
}
