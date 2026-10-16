import { beforeEach, describe, expect, it } from 'vitest';
import { createReportFindingTool } from './create-report-finding-tool.js';
import { FindingService } from '../../business/service/finding-service.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import { FakeProjectPort, FakeTicketPort } from '../../testing/fake-findings-ports.js';
import { InMemoryFindingRepository } from '../../testing/in-memory-finding-repository.js';

const runContext = {
  runId: 'run-7',
  projectId: 'moritz/aisf',
  ticketNumber: 141,
  worktreePath: '/worktrees/aisf/141',
};

import { textResult } from '../../../../shared/testing/text-result.js';
describe('createReportFindingTool', () => {
  let findingRepository: InMemoryFindingRepository;
  let tool: ReturnType<typeof createReportFindingTool>;

  beforeEach(() => {
    findingRepository = new InMemoryFindingRepository();
    tool = createReportFindingTool(
      new FindingService({
        findingRepository,
        ticketPort: new FakeTicketPort(),
        projectPort: new FakeProjectPort(),
        events: new FakeEventPublisher(),
        clock: { now: () => '2026-09-29T10:00:00.000Z' },
      }),
    );
  });

  it('should be named aisf_report_finding', () => {
    expect(tool.name).toBe('aisf_report_finding');
  });

  it('should store the finding against the run ticket when the input is valid', async () => {
    await tool.execute(
      { kind: 'bug', location: 'src/a.ts:12', summary: 'Loop never ends' },
      runContext,
    );

    expect(await findingRepository.list('moritz/aisf', 141)).toMatchObject([
      { runId: 'run-7', kind: 'bug', location: 'src/a.ts:12', summary: 'Loop never ends' },
    ]);
  });

  it('should not end the run when it records a finding', async () => {
    const result = await tool.execute(
      { kind: 'gap', location: 'src/a.ts:12', summary: 'No retry' },
      runContext,
    );

    expect(textResult(result).ending).toBeUndefined();
    expect(textResult(result).text).toBe('Finding recorded.');
  });

  it('should reject when the kind is neither bug nor gap', async () => {
    await expect(
      tool.execute({ kind: 'nit', location: 'src/a.ts:12', summary: 'x' }, runContext),
    ).rejects.toThrow();
  });

  it('should reject when the location or summary is empty', async () => {
    await expect(
      tool.execute({ kind: 'bug', location: '', summary: 'x' }, runContext),
    ).rejects.toThrow();
    await expect(
      tool.execute({ kind: 'bug', location: 'a.ts:1', summary: '' }, runContext),
    ).rejects.toThrow();
  });
});
