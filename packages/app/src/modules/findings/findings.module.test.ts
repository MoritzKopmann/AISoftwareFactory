import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAgentToolRegistry } from '../../shared/in-memory-agent-tool-registry.js';
import { FakeEventPublisher } from '../../shared/testing/fake-event-publisher.js';
import { createFindingsModule, type FindingsModule } from './index.js';
import { FakeProjectsApi, FakeTicketsApi } from './testing/fake-findings-ports.js';
import { InMemoryFindingRepository } from './testing/in-memory-finding-repository.js';

const runContext = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  worktreePath: '/worktrees/aisf/138',
};

describe('createFindingsModule', () => {
  let tickets: FakeTicketsApi;
  let agentTools: InMemoryAgentToolRegistry;
  let findings: FindingsModule;

  beforeEach(async () => {
    tickets = new FakeTicketsApi();
    agentTools = new InMemoryAgentToolRegistry();
    findings = createFindingsModule(
      {
        database: undefined as never,
        agentTools,
        projects: new FakeProjectsApi(),
        tickets,
        events: new FakeEventPublisher(),
        clock: { now: () => '2026-09-29T10:00:00.000Z' },
      },
      { findingRepository: new InMemoryFindingRepository() },
    );
    await agentTools
      .list()[0]
      ?.execute({ kind: 'bug', location: 'src/a.ts:12', summary: 'Loop never ends' }, runContext);
  });

  it('should register the aisf_report_finding tool when the module is created', () => {
    expect(agentTools.list().map(({ name }) => name)).toEqual(['aisf_report_finding']);
  });

  it('should serve a reported finding under /projects/:owner/:name/findings when the ticket is given', async () => {
    const response = await findings.routes.request('/api/projects/moritz/aisf/findings?ticket=138');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      findings: [{ id: 1, ticketNumber: 138, state: 'open' }],
    });
  });

  it('should create one bare issue and mark the finding ticketed when the ticket route is posted', async () => {
    tickets.createdNumber = 210;

    const response = await findings.routes.request('/api/projects/moritz/aisf/findings/1/ticket', {
      method: 'POST',
    });

    expect(await response.json()).toMatchObject({ state: 'ticketed', createdTicketNumber: 210 });
    expect(tickets.createdIdeas).toHaveLength(1);
  });

  it('should answer 409 when the ticket route is posted twice', async () => {
    await findings.routes.request('/api/projects/moritz/aisf/findings/1/ticket', {
      method: 'POST',
    });

    const response = await findings.routes.request('/api/projects/moritz/aisf/findings/1/ticket', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
  });

  it('should answer 404 when the ticket route is posted for an unknown finding', async () => {
    const response = await findings.routes.request('/api/projects/moritz/aisf/findings/99/ticket', {
      method: 'POST',
    });

    expect(response.status).toBe(404);
  });

  it('should keep the finding as dismissed when the dismiss route is posted', async () => {
    await findings.routes.request('/api/projects/moritz/aisf/findings/1/dismiss', {
      method: 'POST',
    });

    const response = await findings.routes.request('/api/projects/moritz/aisf/findings');

    expect(await response.json()).toMatchObject({ findings: [{ state: 'dismissed' }] });
  });

  it('should answer 409 when the dismiss route is posted for a dismissed finding', async () => {
    await findings.routes.request('/api/projects/moritz/aisf/findings/1/dismiss', {
      method: 'POST',
    });

    const response = await findings.routes.request('/api/projects/moritz/aisf/findings/1/dismiss', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
  });
});
