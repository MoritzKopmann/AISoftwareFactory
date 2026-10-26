import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTicketArtifactsRoutes } from './create-ticket-artifacts-routes.js';
import { ticketArtifactsResponseSchema } from '../dto/api/artifacts-schemas.js';
import { ArtifactService } from '../../business/service/artifact-service.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import { FakeArtifactFiles } from '../../testing/fake-artifact-files.js';
import { buildArtifact } from '../../testing/build-artifact.js';
import { FakeRunPort } from '../../testing/fake-run-port.js';
import { InMemoryArtifactRepository } from '../../testing/in-memory-artifact-repository.js';

describe('createTicketArtifactsRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    const artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ token: 'T', artifactId: 'plan', title: 'Plan' }));
    artifactRepository.add(buildArtifact({ token: 'U', artifactId: 'notes', title: 'Notes' }));
    const runPort = new FakeRunPort();
    runPort.latestRun = {
      id: 'r1',
      worktreePath: '/w',
      state: 'running',
      waitingFor: { artifactId: 'plan' },
    };
    app = new Hono().route(
      '/projects',
      createTicketArtifactsRoutes(
        new ArtifactService({
          artifactRepository,
          artifactFiles: new FakeArtifactFiles(),
          runPort,
          events: new FakeEventPublisher(),
          identifiers: { next: () => 'unused' },
          clock: new FakeClock('2026-10-06T10:00:00.000Z'),
        }),
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
