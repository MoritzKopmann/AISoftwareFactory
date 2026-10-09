import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { createFindingsRoutes } from '../../../../../src/modules/findings/api/routes/create-findings-routes.js';
import { findingsResponseSchema } from '../../../../../src/modules/findings/api/schemas/findings-schemas.js';
import { CreateTicketFromFindingUseCase } from '../../../../../src/modules/findings/logic/use-cases/create-ticket-from-finding-use-case.js';
import { DismissFindingUseCase } from '../../../../../src/modules/findings/logic/use-cases/dismiss-finding-use-case.js';
import { ListFindingsUseCase } from '../../../../../src/modules/findings/logic/use-cases/list-findings-use-case.js';
import { InMemoryFindingRepository } from '../../fakes/in-memory-finding-repository.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { FakeProjectLookup, FakeTicketCreator } from '../../fakes/fake-findings-ports.js';

const reportedAt = '2026-09-29T10:00:00.000Z';

function newFinding(ticketNumber: number) {
  return {
    projectId: 'moritz/aisf',
    ticketNumber,
    runId: 'run-1',
    kind: 'bug' as const,
    location: 'src/a.ts:12',
    summary: 'Retry loop never stops',
    reportedAt,
  };
}

describe('createFindingsRoutes', () => {
  let findingRepository: InMemoryFindingRepository;
  let ticketCreator: FakeTicketCreator;
  let app: Hono;

  beforeEach(() => {
    findingRepository = new InMemoryFindingRepository();
    ticketCreator = new FakeTicketCreator();
    const clock = { now: () => '2026-09-29T11:00:00.000Z' };
    app = new Hono().route(
      '/projects',
      createFindingsRoutes(
        new ListFindingsUseCase({ findingRepository }),
        new CreateTicketFromFindingUseCase({
          findingRepository,
          ticketCreator,
          projectLookup: new FakeProjectLookup(),
          events: new FakeEventPublisher(),
          clock,
        }),
        new DismissFindingUseCase({ findingRepository, events: new FakeEventPublisher(), clock }),
      ),
    );
  });

  describe('GET /:owner/:name/findings', () => {
    it('should answer 200 with the project findings when no ticket is given', async () => {
      await findingRepository.insert(newFinding(141));
      await findingRepository.insert(newFinding(142));

      const response = await app.request('/projects/moritz/aisf/findings');

      expect(response.status).toBe(200);
      const body = findingsResponseSchema.parse(await response.json());
      expect(body.findings.map(({ id }) => id)).toEqual([1, 2]);
    });

    it('should list only that ticket when the ticket query is given', async () => {
      await findingRepository.insert(newFinding(141));
      await findingRepository.insert(newFinding(142));

      const response = await app.request('/projects/moritz/aisf/findings?ticket=142');

      const body = findingsResponseSchema.parse(await response.json());
      expect(body.findings.map(({ ticketNumber }) => ticketNumber)).toEqual([142]);
    });

    it('should answer 400 when the ticket query is not a positive integer', async () => {
      const response = await app.request('/projects/moritz/aisf/findings?ticket=abc');

      expect(response.status).toBe(400);
    });

    it('should carry the created ticket number when a finding is ticketed', async () => {
      await findingRepository.insert(newFinding(141));
      ticketCreator.createdNumber = 207;
      await app.request('/projects/moritz/aisf/findings/1/ticket', { method: 'POST' });

      const response = await app.request('/projects/moritz/aisf/findings');

      expect(findingsResponseSchema.parse(await response.json()).findings).toMatchObject([
        { state: 'ticketed', createdTicketNumber: 207 },
      ]);
    });
  });

  describe('POST /:owner/:name/findings/:id/ticket', () => {
    it('should answer 200 with the ticketed finding when Create ticket is used', async () => {
      await findingRepository.insert(newFinding(141));
      ticketCreator.createdNumber = 207;

      const response = await app.request('/projects/moritz/aisf/findings/1/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: 1,
        state: 'ticketed',
        createdTicketNumber: 207,
      });
    });

    it('should answer 404 when the finding is unknown', async () => {
      const response = await app.request('/projects/moritz/aisf/findings/9/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(404);
    });

    it('should answer 409 when the finding is not open', async () => {
      await findingRepository.insert(newFinding(141));
      await app.request('/projects/moritz/aisf/findings/1/ticket', { method: 'POST' });

      const response = await app.request('/projects/moritz/aisf/findings/1/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(409);
    });

    it('should answer 400 when the finding id is not a positive integer', async () => {
      const response = await app.request('/projects/moritz/aisf/findings/abc/ticket', {
        method: 'POST',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /:owner/:name/findings/:id/dismiss', () => {
    it('should answer 200 with the dismissed finding when Dismiss is used', async () => {
      await findingRepository.insert(newFinding(141));

      const response = await app.request('/projects/moritz/aisf/findings/1/dismiss', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: 1, state: 'dismissed' });
    });

    it('should answer 404 when the finding is unknown', async () => {
      const response = await app.request('/projects/moritz/aisf/findings/9/dismiss', {
        method: 'POST',
      });

      expect(response.status).toBe(404);
    });

    it('should answer 409 when the finding is not open', async () => {
      await findingRepository.insert(newFinding(141));
      await app.request('/projects/moritz/aisf/findings/1/dismiss', { method: 'POST' });

      const response = await app.request('/projects/moritz/aisf/findings/1/dismiss', {
        method: 'POST',
      });

      expect(response.status).toBe(409);
    });
  });
});
