import { beforeEach, describe, expect, it } from 'vitest';
import { TicketCreationFailedError } from '../../../../../src/modules/findings/logic/errors/ticket-creation-failed-error.js';
import { FindingNotFoundError } from '../../../../../src/modules/findings/logic/errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../../../../../src/modules/findings/logic/errors/finding-not-open-error.js';
import { CreateTicketFromFindingUseCase } from '../../../../../src/modules/findings/logic/use-cases/create-ticket-from-finding-use-case.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { FakeProjectLookup, FakeTicketCreator } from '../../fakes/fake-findings-ports.js';
import { InMemoryFindingRepository } from '../../fakes/in-memory-finding-repository.js';

const newFinding = {
  projectId: 'moritz/aisf',
  ticketNumber: 141,
  runId: 'run-1',
  kind: 'gap',
  location: 'src/a.ts:12',
  summary: 'Missing retry',
  reportedAt: '2026-09-29T10:00:00.000Z',
} as const;

describe('CreateTicketFromFindingUseCase', () => {
  let findingRepository: InMemoryFindingRepository;
  let ticketCreator: FakeTicketCreator;
  let createTicketFromFinding: CreateTicketFromFindingUseCase;
  let events: FakeEventPublisher;
  let statesAtEmit: Array<Promise<string | undefined>>;

  beforeEach(async () => {
    findingRepository = new InMemoryFindingRepository();
    ticketCreator = new FakeTicketCreator();
    events = new FakeEventPublisher();
    statesAtEmit = [];
    createTicketFromFinding = new CreateTicketFromFindingUseCase({
      findingRepository,
      events: {
        emit: (...emitted) => {
          events.emit(...emitted);
          statesAtEmit.push(findingRepository.findById(3).then((found) => found?.state));
        },
      },
      ticketCreator,
      projectLookup: new FakeProjectLookup(),
      clock: { now: () => '2026-09-29T11:00:00.000Z' },
    });
    await findingRepository.insert(newFinding);
    await findingRepository.insert(newFinding);
    await findingRepository.insert(newFinding);
  });

  it('should create one bare idea from the finding when Create ticket is used', async () => {
    await createTicketFromFinding.execute('moritz/aisf', 1);

    expect(ticketCreator.createdTickets).toEqual([
      {
        title: 'Missing retry',
        body: 'Kind: gap\nLocation: `src/a.ts:12`\n\nFound while implementing #141',
      },
    ]);
  });

  it('should record the new issue number and mark the finding ticketed when the issue is created', async () => {
    ticketCreator.createdNumber = 207;

    const ticketed = await createTicketFromFinding.execute('moritz/aisf', 1);

    expect(ticketed).toMatchObject({
      state: 'ticketed',
      createdTicketNumber: 207,
      resolvedAt: '2026-09-29T11:00:00.000Z',
    });
    expect(await findingRepository.findById(1)).toEqual(ticketed);
  });

  it('should create only one issue when Create ticket is used twice at once', async () => {
    const outcomes = await Promise.allSettled([
      createTicketFromFinding.execute('moritz/aisf', 1),
      createTicketFromFinding.execute('moritz/aisf', 1),
    ]);

    expect(ticketCreator.createdTickets).toHaveLength(1);
    expect(outcomes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejection = outcomes.find(({ status }) => status === 'rejected');
    expect(rejection).toMatchObject({ reason: expect.any(FindingNotOpenError) });
  });

  it('should throw FindingNotOpenError when the finding is already ticketed', async () => {
    await createTicketFromFinding.execute('moritz/aisf', 1);

    await expect(createTicketFromFinding.execute('moritz/aisf', 1)).rejects.toThrow(
      FindingNotOpenError,
    );
  });

  it('should reopen the finding and rethrow when the ticket creator fails', async () => {
    ticketCreator.error = new TicketCreationFailedError('rate limited');

    await expect(createTicketFromFinding.execute('moritz/aisf', 1)).rejects.toThrow(
      TicketCreationFailedError,
    );
    expect((await findingRepository.findById(1))?.state).toBe('open');
  });

  it('should throw FindingNotFoundError when the finding belongs to another project', async () => {
    await expect(createTicketFromFinding.execute('moritz/other', 1)).rejects.toThrow(
      FindingNotFoundError,
    );
    expect(ticketCreator.createdTickets).toEqual([]);
  });

  it('should emit finding.changed while creating and again when ticketed when GitHub succeeds', async () => {
    await createTicketFromFinding.execute('moritz/aisf', 3);

    const payload = { projectId: 'moritz/aisf', ticketNumber: 141, findingId: 3 };
    expect(events.emittedEvents).toEqual([
      { name: 'finding.changed', payload },
      { name: 'finding.changed', payload },
    ]);
    expect(await Promise.all(statesAtEmit)).toEqual(['creating', 'ticketed']);
  });

  it('should emit finding.changed after the release when GitHub fails', async () => {
    ticketCreator.error = new TicketCreationFailedError('rate limited');

    await expect(createTicketFromFinding.execute('moritz/aisf', 3)).rejects.toThrow(
      TicketCreationFailedError,
    );

    expect(await Promise.all(statesAtEmit)).toEqual(['creating', 'open']);
  });
});
