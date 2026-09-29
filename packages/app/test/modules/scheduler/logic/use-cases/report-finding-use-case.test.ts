import { beforeEach, describe, expect, it } from 'vitest';
import { ReportFindingUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/report-finding-use-case.js';
import { InMemoryFindingRepository } from '../../fakes/in-memory-finding-repository.js';

describe('ReportFindingUseCase', () => {
  let findingRepository: InMemoryFindingRepository;
  let reportFinding: ReportFindingUseCase;

  beforeEach(() => {
    findingRepository = new InMemoryFindingRepository();
    reportFinding = new ReportFindingUseCase({
      findingRepository,
      clock: { now: () => '2026-09-29T10:00:00.000Z' },
    });
  });

  it('should store an open finding against the run ticket when a finding is reported', async () => {
    await reportFinding.execute({
      projectId: 'moritz/aisf',
      ticketNumber: 141,
      runId: 'run-1',
      kind: 'gap',
      location: 'src/a.ts:12',
      summary: 'Missing retry',
    });

    expect(await findingRepository.list('moritz/aisf', 141)).toEqual([
      {
        id: 1,
        projectId: 'moritz/aisf',
        ticketNumber: 141,
        runId: 'run-1',
        kind: 'gap',
        location: 'src/a.ts:12',
        summary: 'Missing retry',
        state: 'open',
        reportedAt: '2026-09-29T10:00:00.000Z',
      },
    ]);
  });
});
