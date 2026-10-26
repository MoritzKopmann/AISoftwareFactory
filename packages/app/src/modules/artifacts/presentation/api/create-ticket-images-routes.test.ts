import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTicketImagesRoutes } from './create-ticket-images-routes.js';
import { ticketImagesResponseSchema } from '../dto/api/images-schemas.js';
import { TicketImageService } from '../../business/service/ticket-image-service.js';
import { FakeArtifactFiles } from '../../testing/fake-artifact-files.js';
import { FakeRunPort } from '../../testing/fake-run-port.js';

describe('createTicketImagesRoutes', () => {
  let app: Hono;

  beforeEach(() => {
    const artifactFiles = new FakeArtifactFiles();
    for (const name of ['card-dark.png', 'card-light.png', 'flow.svg']) {
      artifactFiles.files.set(`/w/.aisf/images/${name}`, 'x');
    }
    const runPort = new FakeRunPort();
    runPort.latestRun = { id: 'r1', worktreePath: '/w', state: 'running' };
    app = new Hono().route(
      '/api/projects',
      createTicketImagesRoutes(new TicketImageService({ runPort, artifactFiles })),
    );
  });

  it('should list each image with its url when the ticket has images', async () => {
    const response = await app.request('/api/projects/o/r/tickets/41/images');

    expect(response.status).toBe(200);
    expect(ticketImagesResponseSchema.parse(await response.json())).toEqual({
      images: [
        { name: 'card-dark.png', url: '/api/projects/o/r/tickets/41/images/card-dark.png' },
        { name: 'card-light.png', url: '/api/projects/o/r/tickets/41/images/card-light.png' },
        { name: 'flow.svg', url: '/api/projects/o/r/tickets/41/images/flow.svg' },
      ],
    });
  });

  it('should serve the image with its type and nosniff when it exists', async () => {
    const response = await app.request('/api/projects/o/r/tickets/41/images/card-light.png');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should lock down script when the image is an svg', async () => {
    const response = await app.request('/api/projects/o/r/tickets/41/images/flow.svg');

    expect(response.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; style-src 'unsafe-inline'",
    );
  });

  it('should answer 404 when the image is unknown', async () => {
    const response = await app.request('/api/projects/o/r/tickets/41/images/missing.png');

    expect(response.status).toBe(404);
  });

  it('should answer 400 when the ticket number is invalid', async () => {
    const response = await app.request('/api/projects/o/r/tickets/abc/images');

    expect(response.status).toBe(400);
  });
});
