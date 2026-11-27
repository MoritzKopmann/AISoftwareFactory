import { describe, expect, it } from 'vitest';
import { FakeTicketsApi, repository } from '../../testing/fake-findings-ports.js';
import { TicketsAdapter } from './tickets-adapter.js';

describe('TicketsAdapter', () => {
  it('should pass the types to createIdea when the issue has types', async () => {
    const tickets = new FakeTicketsApi();
    const adapter = new TicketsAdapter(tickets);

    await adapter.create(repository, { title: 'Retry loop', body: 'Kind: bug', types: ['bug'] });

    expect(tickets.createdIdeas).toEqual([
      { title: 'Retry loop', body: 'Kind: bug', types: ['bug'] },
    ]);
  });

  it('should pass no types to createIdea when the issue has no types', async () => {
    const tickets = new FakeTicketsApi();
    const adapter = new TicketsAdapter(tickets);

    await adapter.create(repository, { title: 'Retry loop', body: 'Kind: gap' });

    expect(tickets.createdIdeas).toEqual([{ title: 'Retry loop', body: 'Kind: gap' }]);
    expect(tickets.createdIdeas[0]).not.toHaveProperty('types');
  });
});
