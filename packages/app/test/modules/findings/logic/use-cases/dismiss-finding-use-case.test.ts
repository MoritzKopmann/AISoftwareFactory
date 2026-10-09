import { beforeEach, describe, expect, it } from 'vitest';
import { FindingNotFoundError } from '../../../../../src/modules/findings/logic/errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../../../../../src/modules/findings/logic/errors/finding-not-open-error.js';
import { DismissFindingUseCase } from '../../../../../src/modules/findings/logic/use-cases/dismiss-finding-use-case.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
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
  let events: FakeEventPublisher;

  beforeEach(async () => {
    findingRepository = new InMemoryFindingRepository();
    events = new FakeEventPublisher();
    dismissFinding = new DismissFindingUseCase({
      findingRepository,
      events,
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

  it('should emit finding.changed once the finding lists as dismissed when it is dismissed', async () => {
    const statesAtEmit: Array<Promise<ReadonlyArray<{ readonly state: string }>>> = [];
    dismissFinding = new DismissFindingUseCase({
      findingRepository,
      events: {
        emit: (...emitted) => {
          events.emit(...emitted);
          statesAtEmit.push(findingRepository.list('moritz/aisf', 141));
        },
      },
      clock: { now: () => '2026-09-29T11:00:00.000Z' },
    });

    await dismissFinding.execute('moritz/aisf', 1);

    expect(events.emittedEvents).toEqual([
      {
        name: 'finding.changed',
        payload: { projectId: 'moritz/aisf', ticketNumber: 141, findingId: 1 },
      },
    ]);
    expect((await statesAtEmit[0])?.map(({ state }) => state)).toEqual(['dismissed']);
  });

  it('should not emit when the finding is already dismissed', async () => {
    await dismissFinding.execute('moritz/aisf', 1);
    events.emittedEvents.length = 0;

    await expect(dismissFinding.execute('moritz/aisf', 1)).rejects.toThrow(FindingNotOpenError);
    expect(events.emittedEvents).toEqual([]);
  });
});
