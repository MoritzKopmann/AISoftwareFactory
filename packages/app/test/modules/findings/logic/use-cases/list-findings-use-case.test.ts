import { beforeEach, describe, expect, it } from 'vitest';
import { ListFindingsUseCase } from '../../../../../src/modules/findings/logic/use-cases/list-findings-use-case.js';
import { InMemoryFindingRepository } from '../../fakes/in-memory-finding-repository.js';

const reportedAt = '2026-09-29T10:00:00.000Z';

describe('ListFindingsUseCase', () => {
  let findingRepository: InMemoryFindingRepository;
  let listFindings: ListFindingsUseCase;

  beforeEach(async () => {
    findingRepository = new InMemoryFindingRepository();
    listFindings = new ListFindingsUseCase({ findingRepository });
    const base = {
      runId: 'run-1',
      kind: 'bug',
      location: 'a.ts:1',
      summary: 's',
      reportedAt,
    } as const;
    await findingRepository.insert({ ...base, projectId: 'moritz/aisf', ticketNumber: 141 });
    await findingRepository.insert({ ...base, projectId: 'moritz/aisf', ticketNumber: 142 });
    await findingRepository.insert({ ...base, projectId: 'moritz/other', ticketNumber: 141 });
  });

  it('should list every finding of the project when no ticket is given', async () => {
    const findings = await listFindings.execute('moritz/aisf');

    expect(findings.map(({ ticketNumber }) => ticketNumber)).toEqual([141, 142]);
  });

  it('should list only that ticket findings when a ticket is given', async () => {
    const findings = await listFindings.execute('moritz/aisf', 142);

    expect(findings.map(({ id }) => id)).toEqual([2]);
  });
});
