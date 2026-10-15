import { beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import { FakeProjectLookup, FakeTicketCreator } from '../../testing/fake-findings-ports.js';
import { InMemoryFindingRepository } from '../../testing/in-memory-finding-repository.js';
import { FindingNotFoundError } from '../errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../errors/finding-not-open-error.js';
import { TicketCreationFailedError } from '../errors/ticket-creation-failed-error.js';
import { FindingService } from './finding-service.js';

const newFinding = {
  projectId: 'moritz/aisf',
  ticketNumber: 141,
  runId: 'run-1',
  kind: 'gap',
  location: 'src/a.ts:12',
  summary: 'Missing retry',
  reportedAt: '2026-09-29T10:00:00.000Z',
} as const;

const clock: Clock = { now: () => '2026-09-29T11:00:00.000Z' };

describe('FindingService', () => {
  let findingRepository: InMemoryFindingRepository;
  let ticketCreator: FakeTicketCreator;
  let events: FakeEventPublisher;
  let findingService: FindingService;
  let statesAtEmit: Array<Promise<string | undefined>>;

  function buildService(observed: EventPublisher): FindingService {
    return new FindingService({
      findingRepository,
      ticketCreator,
      projectLookup: new FakeProjectLookup(),
      events: observed,
      clock,
    });
  }

  beforeEach(() => {
    findingRepository = new InMemoryFindingRepository();
    ticketCreator = new FakeTicketCreator();
    events = new FakeEventPublisher();
    statesAtEmit = [];
    findingService = buildService({
      emit: (...emitted) => {
        events.emit(...emitted);
        statesAtEmit.push(findingRepository.findById(1).then((found) => found?.state));
      },
    });
  });

  describe('report', () => {
    it('should store an open finding against the run ticket when a finding is reported', async () => {
      await findingService.report({
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
          reportedAt: '2026-09-29T11:00:00.000Z',
        },
      ]);
    });

    it('should emit finding.changed after the finding is stored when a finding is reported', async () => {
      const finding = await findingService.report({
        projectId: 'moritz/aisf',
        ticketNumber: 141,
        runId: 'run-1',
        kind: 'bug',
        location: 'a.ts:1',
        summary: 's',
      });

      expect(events.emittedEvents).toEqual([
        {
          name: 'finding.changed',
          payload: { projectId: 'moritz/aisf', ticketNumber: 141, findingId: finding.id },
        },
      ]);
      expect(await Promise.all(statesAtEmit)).toEqual(['open']);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await findingRepository.insert({ ...newFinding });
      await findingRepository.insert({ ...newFinding, ticketNumber: 142 });
      await findingRepository.insert({ ...newFinding, projectId: 'moritz/other' });
    });

    it('should list every finding of the project when no ticket is given', async () => {
      const findings = await findingService.list('moritz/aisf');

      expect(findings.map(({ ticketNumber }) => ticketNumber)).toEqual([141, 142]);
    });

    it('should list only that ticket findings when a ticket is given', async () => {
      const findings = await findingService.list('moritz/aisf', 142);

      expect(findings.map(({ id }) => id)).toEqual([2]);
    });
  });

  describe('dismiss', () => {
    beforeEach(async () => {
      await findingRepository.insert({ ...newFinding });
    });

    it('should keep the finding stored as dismissed when it is dismissed', async () => {
      const dismissed = await findingService.dismiss('moritz/aisf', 1);

      expect(dismissed).toMatchObject({
        id: 1,
        state: 'dismissed',
        resolvedAt: '2026-09-29T11:00:00.000Z',
      });
      expect(await findingRepository.findById(1)).toEqual(dismissed);
    });

    it('should throw FindingNotFoundError when the finding does not exist', async () => {
      await expect(findingService.dismiss('moritz/aisf', 9)).rejects.toThrow(FindingNotFoundError);
    });

    it('should throw FindingNotFoundError when the finding belongs to another project', async () => {
      await expect(findingService.dismiss('moritz/other', 1)).rejects.toThrow(FindingNotFoundError);
    });

    it('should throw FindingNotOpenError when the finding is already dismissed', async () => {
      await findingService.dismiss('moritz/aisf', 1);

      await expect(findingService.dismiss('moritz/aisf', 1)).rejects.toThrow(FindingNotOpenError);
    });

    it('should emit finding.changed once the finding is dismissed when it is dismissed', async () => {
      await findingService.dismiss('moritz/aisf', 1);

      expect(events.emittedEvents).toEqual([
        {
          name: 'finding.changed',
          payload: { projectId: 'moritz/aisf', ticketNumber: 141, findingId: 1 },
        },
      ]);
      expect(await Promise.all(statesAtEmit)).toEqual(['dismissed']);
    });

    it('should not emit when the finding is already dismissed', async () => {
      await findingService.dismiss('moritz/aisf', 1);
      events.emittedEvents.length = 0;

      await expect(findingService.dismiss('moritz/aisf', 1)).rejects.toThrow(FindingNotOpenError);
      expect(events.emittedEvents).toEqual([]);
    });
  });

  describe('createTicket', () => {
    beforeEach(async () => {
      await findingRepository.insert({ ...newFinding });
    });

    it('should create one bare idea from the finding when Create ticket is used', async () => {
      await findingService.createTicket('moritz/aisf', 1);

      expect(ticketCreator.createdTickets).toEqual([
        {
          title: 'Missing retry',
          body: 'Kind: gap\nLocation: `src/a.ts:12`\n\nFound while implementing #141',
        },
      ]);
    });

    it('should record the new issue number and mark the finding ticketed when the issue is created', async () => {
      ticketCreator.createdNumber = 207;

      const ticketed = await findingService.createTicket('moritz/aisf', 1);

      expect(ticketed).toMatchObject({
        state: 'ticketed',
        createdTicketNumber: 207,
        resolvedAt: '2026-09-29T11:00:00.000Z',
      });
      expect(await findingRepository.findById(1)).toEqual(ticketed);
    });

    it('should create only one issue when Create ticket is used twice at once', async () => {
      const outcomes = await Promise.allSettled([
        findingService.createTicket('moritz/aisf', 1),
        findingService.createTicket('moritz/aisf', 1),
      ]);

      expect(ticketCreator.createdTickets).toHaveLength(1);
      expect(outcomes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
      const rejection = outcomes.find(({ status }) => status === 'rejected');
      expect(rejection).toMatchObject({ reason: expect.any(FindingNotOpenError) });
    });

    it('should throw FindingNotOpenError when the finding is already ticketed', async () => {
      await findingService.createTicket('moritz/aisf', 1);

      await expect(findingService.createTicket('moritz/aisf', 1)).rejects.toThrow(
        FindingNotOpenError,
      );
    });

    it('should reopen the finding and rethrow when the ticket creator fails', async () => {
      ticketCreator.error = new TicketCreationFailedError('rate limited');

      await expect(findingService.createTicket('moritz/aisf', 1)).rejects.toThrow(
        TicketCreationFailedError,
      );
      expect((await findingRepository.findById(1))?.state).toBe('open');
    });

    it('should throw FindingNotFoundError when the finding belongs to another project', async () => {
      await expect(findingService.createTicket('moritz/other', 1)).rejects.toThrow(
        FindingNotFoundError,
      );
      expect(ticketCreator.createdTickets).toEqual([]);
    });

    it('should emit finding.changed while creating and again when ticketed when GitHub succeeds', async () => {
      await findingService.createTicket('moritz/aisf', 1);

      const payload = { projectId: 'moritz/aisf', ticketNumber: 141, findingId: 1 };
      expect(events.emittedEvents).toEqual([
        { name: 'finding.changed', payload },
        { name: 'finding.changed', payload },
      ]);
      expect(await Promise.all(statesAtEmit)).toEqual(['creating', 'ticketed']);
    });

    it('should emit finding.changed after the release when GitHub fails', async () => {
      ticketCreator.error = new TicketCreationFailedError('rate limited');

      await expect(findingService.createTicket('moritz/aisf', 1)).rejects.toThrow(
        TicketCreationFailedError,
      );

      expect(await Promise.all(statesAtEmit)).toEqual(['creating', 'open']);
    });
  });
});
