import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTicketArtifactsRoutes } from '../../../../../src/modules/artifacts/api/routes/create-ticket-artifacts-routes.js';
import { ticketArtifactsResponseSchema } from '../../../../../src/modules/artifacts/api/schemas/artifacts-schemas.js';
import { ListTicketArtifactsUseCase } from '../../../../../src/modules/artifacts/logic/use-cases/list-ticket-artifacts-use-case.js';
import { buildArtifact } from '../../fakes/build-artifact.js';
import { FakeTicketRunLookup } from '../../fakes/fake-ticket-run-lookup.js';
import { InMemoryArtifactRepository } from '../../fakes/in-memory-artifact-repository.js';

describe('createTicketArtifactsRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    const artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ token: 'T', artifactId: 'plan', title: 'Plan' }));
    artifactRepository.add(buildArtifact({ token: 'U', artifactId: 'notes', title: 'Notes' }));
    const ticketRunLookup = new FakeTicketRunLookup();
    ticketRunLookup.latestRun = { id: 'r1', state: 'running', waitingFor: { artifactId: 'plan' } };
    app = new Hono().route(
      '/projects',
      createTicketArtifactsRoutes(
        new ListTicketArtifactsUseCase({ artifactRepository, ticketRunLookup }),
      ),
    );
  });

  it('should list the ticket artifacts with url and status when the ticket has some', async () => {
    const response = await app.request('/projects/o/n/tickets/7/artifacts');

    expect(response.status).toBe(200);
    const body = ticketArtifactsResponseSchema.parse(await response.json());
    expect(body).toEqual({
      artifacts: [
        { artifactId: 'plan', title: 'Plan', url: '/a/T/', status: 'open' },
        { artifactId: 'notes', title: 'Notes', url: '/a/U/', status: 'closed' },
      ],
    });
  });

  it('should answer 400 when the ticket number is invalid', async () => {
    const response = await app.request('/projects/o/n/tickets/abc/artifacts');

    expect(response.status).toBe(400);
  });
});
