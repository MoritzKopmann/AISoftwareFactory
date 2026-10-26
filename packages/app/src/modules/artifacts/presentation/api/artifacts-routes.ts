import { Hono } from 'hono';
import type { ArtifactService } from '../../business/service/artifact-service.js';
import type { PageService } from '../../business/service/page-service.js';
import type { TicketImageService } from '../../business/service/ticket-image-service.js';
import { createKitRoutes } from './create-kit-routes.js';
import { createPageRoutes } from './create-page-routes.js';
import { createTicketArtifactsRoutes } from './create-ticket-artifacts-routes.js';
import { createTicketImagesRoutes } from './create-ticket-images-routes.js';

export type ArtifactsRoutesOptions = {
  readonly kitDirectory: string;
  readonly artifactService: ArtifactService;
  readonly pageService: PageService;
  readonly ticketImageService: TicketImageService;
};

/** The module's route table, with full paths. */
export function createArtifactsRoutes(options: ArtifactsRoutesOptions): Hono {
  return new Hono()
    .route('/aisf', createKitRoutes({ kitDirectory: options.kitDirectory }))
    .route('/a', createPageRoutes(options.pageService))
    .route('/api/projects', createTicketArtifactsRoutes(options.artifactService))
    .route('/api/projects', createTicketImagesRoutes(options.ticketImageService));
}
