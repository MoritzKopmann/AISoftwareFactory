import type { ProjectLookup } from '../business/port/project/project-lookup.js';
import type { TicketCreator } from '../business/port/ticket/ticket-creator.js';
import type { ProjectDto, ProjectsApi } from '../../projects/index.js';
import type { RepositoryReferenceDto, TicketsApi } from '../../tickets/index.js';

export const repository = { owner: 'moritz', name: 'aisf' };

export const knownProject: ProjectDto = {
  id: 'moritz/aisf',
  repository,
  checkoutPath: '/checkouts/aisf',
  addedAt: '2026-09-29T09:00:00.000Z',
  contract: { passed: true, missingSlots: [], missingKeys: [] },
};

export class FakeTicketCreator implements TicketCreator {
  createdNumber = 200;
  error: Error | undefined;
  readonly createdTickets: Array<{ readonly title: string; readonly body: string }> = [];

  async create(
    _repository: { readonly owner: string; readonly name: string },
    ticket: { readonly title: string; readonly body: string },
  ): Promise<number> {
    if (this.error !== undefined) {
      throw this.error;
    }
    this.createdTickets.push(ticket);
    return this.createdNumber;
  }
}

export class FakeProjectLookup implements ProjectLookup {
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
  readonly createdIdeas: Array<{ readonly title: string; readonly body: string }> = [];

  async createIdea(
    _repository: RepositoryReferenceDto,
    idea: { readonly title: string; readonly body: string },
  ): Promise<number> {
    this.createdIdeas.push(idea);
    return this.createdNumber;
  }
}
