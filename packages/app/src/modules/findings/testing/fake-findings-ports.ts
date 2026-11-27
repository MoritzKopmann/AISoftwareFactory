import type { FindingIssue } from '../business/domain/types/finding-issue.js';
import type { ProjectPort } from '../business/port/project/project-port.js';
import type { TicketPort } from '../business/port/ticket/ticket-port.js';
import type { ProjectDto, ProjectsApi } from '../../projects/index.js';
import type { IdeaDto, RepositoryReferenceDto, TicketsApi } from '../../tickets/index.js';

export const repository = { owner: 'moritz', name: 'aisf' };

export const knownProject: ProjectDto = {
  id: 'moritz/aisf',
  repository,
  checkoutPath: '/checkouts/aisf',
  addedAt: '2026-09-29T09:00:00.000Z',
  paused: false,
  contract: { passed: true, missingSlots: [], missingKeys: [] },
};

export class FakeTicketPort implements TicketPort {
  createdNumber = 200;
  error: Error | undefined;
  readonly createdTickets: Array<FindingIssue> = [];

  async create(
    _repository: { readonly owner: string; readonly name: string },
    issue: FindingIssue,
  ): Promise<number> {
    if (this.error !== undefined) {
      throw this.error;
    }
    this.createdTickets.push(issue);
    return this.createdNumber;
  }
}

export class FakeProjectPort implements ProjectPort {
  constructor(private readonly known: boolean = true) {}

  async find(): Promise<{ readonly repository: typeof repository } | undefined> {
    return this.known ? { repository } : undefined;
  }
}

export class FakeProjectsApi implements Pick<ProjectsApi, 'list'> {
  constructor(private readonly projects: ReadonlyArray<ProjectDto> = [knownProject]) {}

  async list(): Promise<ReadonlyArray<ProjectDto>> {
    return this.projects;
  }
}

export class FakeTicketsApi implements Pick<TicketsApi, 'createIdea'> {
  createdNumber = 200;
  readonly createdIdeas: Array<IdeaDto> = [];

  async createIdea(_repository: RepositoryReferenceDto, idea: IdeaDto): Promise<number> {
    this.createdIdeas.push(idea);
    return this.createdNumber;
  }
}
