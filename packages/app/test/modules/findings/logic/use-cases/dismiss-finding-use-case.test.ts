import { beforeEach, describe, expect, it } from 'vitest';
import { FindingNotFoundError } from '../../../../../src/modules/findings/logic/errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../../../../../src/modules/findings/logic/errors/finding-not-open-error.js';
import { DismissFindingUseCase } from '../../../../../src/modules/findings/logic/use-cases/dismiss-finding-use-case.js';
import { InMemoryFindingRepository } from '../../fakes/in-memory-finding-repository.js';

const newFinding = {
  projectId: 'moritz/aisf',
  ticketNumber: 141,
  runId: 'run-1',
  kind: 'bug',
  location: 'a.ts:1',
  summary: 's',
  reportedAt: '2026-09-29T10:00:00.000Z',
} as const;

describe('DismissFindingUseCase', () => {
  let findingRepository: InMemoryFindingRepository;
  let dismissFinding: DismissFindingUseCase;

  beforeEach(async () => {
    findingRepository = new InMemoryFindingRepository();
    dismissFinding = new DismissFindingUseCase({
      findingRepository,
      clock: { now: () => '2026-09-29T11:00:00.000Z' },
    });
    await findingRepository.insert(newFinding);
  });

  it('should keep the finding stored as dismissed when it is dismissed', async () => {
    const dismissed = await dismissFinding.execute('moritz/aisf', 1);

    expect(dismissed).toMatchObject({
      id: 1,
      state: 'dismissed',
      resolvedAt: '2026-09-29T11:00:00.000Z',
    });
    expect(await findingRepository.findById(1)).toEqual(dismissed);
  });

  it('should throw FindingNotFoundError when the finding does not exist', async () => {
    await expect(dismissFinding.execute('moritz/aisf', 9)).rejects.toThrow(FindingNotFoundError);
  });

  it('should throw FindingNotFoundError when the finding belongs to another project', async () => {
    await expect(dismissFinding.execute('moritz/other', 1)).rejects.toThrow(FindingNotFoundError);
  });

  it('should throw FindingNotOpenError when the finding is already dismissed', async () => {
    await dismissFinding.execute('moritz/aisf', 1);

    await expect(dismissFinding.execute('moritz/aisf', 1)).rejects.toThrow(FindingNotOpenError);
  });
});
