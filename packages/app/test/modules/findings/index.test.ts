import { beforeEach, describe, expect, it } from 'vitest';
import {
  createFindingsModule,
  FindingNotFoundError,
  FindingNotOpenError,
  type FindingsModule,
} from '../../../src/modules/findings/index.js';
import { InMemoryFindingRepository } from './fakes/in-memory-finding-repository.js';
import { FakeProjectLookup, FakeTicketCreator } from './fakes/fake-findings-ports.js';

const runContext = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  worktreePath: '/worktrees/aisf/138',
};

describe('createFindingsModule', () => {
  let ticketCreator: FakeTicketCreator;
  let findings: FindingsModule;

  beforeEach(async () => {
    ticketCreator = new FakeTicketCreator();
    findings = createFindingsModule({
      findingRepository: new InMemoryFindingRepository(),
      ticketCreator,
      projectLookup: new FakeProjectLookup(),
      clock: { now: () => '2026-09-29T10:00:00.000Z' },
    });
    await findings.tools[0]?.execute(
      { kind: 'bug', location: 'src/a.ts:12', summary: 'Loop never ends' },
      runContext,
    );
  });

  it('should offer the aisf_report_finding tool when the module is created', () => {
    expect(findings.tools.map(({ name }) => name)).toEqual(['aisf_report_finding']);
  });

  it('should list a reported finding when list is called for its ticket', async () => {
    expect(await findings.list('moritz/aisf', 138)).toMatchObject([
      { id: 1, ticketNumber: 138, state: 'open' },
    ]);
  });

  it('should create one bare issue and mark the finding ticketed when createTicket is called', async () => {
    ticketCreator.createdNumber = 210;

    const finding = await findings.createTicket('moritz/aisf', 1);

    expect(finding).toMatchObject({ state: 'ticketed', createdTicketNumber: 210 });
    expect(ticketCreator.createdTickets).toHaveLength(1);
  });

  it('should throw FindingNotOpenError when createTicket is called twice', async () => {
    await findings.createTicket('moritz/aisf', 1);

    await expect(findings.createTicket('moritz/aisf', 1)).rejects.toThrow(FindingNotOpenError);
  });

  it('should throw FindingNotFoundError when createTicket is called for an unknown finding', async () => {
    await expect(findings.createTicket('moritz/aisf', 99)).rejects.toThrow(FindingNotFoundError);
  });

  it('should keep the finding as dismissed when dismiss is called', async () => {
    await findings.dismiss('moritz/aisf', 1);

    expect(await findings.list('moritz/aisf')).toMatchObject([{ state: 'dismissed' }]);
  });

  it('should throw FindingNotOpenError when dismiss is called for a dismissed finding', async () => {
    await findings.dismiss('moritz/aisf', 1);

    await expect(findings.dismiss('moritz/aisf', 1)).rejects.toThrow(FindingNotOpenError);
  });
});
