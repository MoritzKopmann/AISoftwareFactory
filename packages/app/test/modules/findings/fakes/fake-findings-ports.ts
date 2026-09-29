import type { ProjectLookup } from '../../../../src/modules/findings/logic/ports/project-lookup.js';
import type { TicketCreator } from '../../../../src/modules/findings/logic/ports/ticket-creator.js';

export const repository = { owner: 'moritz', name: 'aisf' };

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
