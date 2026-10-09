import { beforeEach, describe, expect, it } from 'vitest';
import { ReportFindingUseCase } from '../../../../../src/modules/findings/logic/use-cases/report-finding-use-case.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { InMemoryFindingRepository } from '../../fakes/in-memory-finding-repository.js';

describe('ReportFindingUseCase', () => {
  let findingRepository: InMemoryFindingRepository;
  let reportFinding: ReportFindingUseCase;
  let events: FakeEventPublisher;

  beforeEach(() => {
    findingRepository = new InMemoryFindingRepository();
    events = new FakeEventPublisher();
    reportFinding = new ReportFindingUseCase({
      findingRepository,
      events,
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

  it('should emit finding.changed after the finding is stored when a finding is reported', async () => {
    const statesAtEmit: Array<Promise<ReadonlyArray<{ readonly state: string }>>> = [];
    const observing = {
      emit: (...emitted: Parameters<FakeEventPublisher['emit']>) => {
        events.emit(...emitted);
        statesAtEmit.push(findingRepository.list('moritz/aisf', 7));
      },
    };
    reportFinding = new ReportFindingUseCase({
      findingRepository,
      events: observing,
      clock: { now: () => '2026-09-29T10:00:00.000Z' },
    });

    const finding = await reportFinding.execute({
      projectId: 'moritz/aisf',
      ticketNumber: 7,
      runId: 'run-1',
      kind: 'bug',
      location: 'a.ts:1',
      summary: 's',
    });

    expect(events.emittedEvents).toEqual([
      {
        name: 'finding.changed',
        payload: { projectId: 'moritz/aisf', ticketNumber: 7, findingId: finding.id },
      },
    ]);
    expect((await statesAtEmit[0])?.map(({ state }) => state)).toEqual(['open']);
  });
});
