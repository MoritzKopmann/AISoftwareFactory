import { Hono } from 'hono';
import type { Clock } from '../../shared/clock/clock.js';
import type { Identifiers } from '../../shared/identifiers/identifiers.js';
import type { RunTool } from '../runner/index.js';
import { createKitRoutes } from './api/routes/create-kit-routes.js';
import { createPageRoutes } from './api/routes/create-page-routes.js';
import { createTicketArtifactsRoutes } from './api/routes/create-ticket-artifacts-routes.js';
import { createShowArtifactTool } from './api/tools/create-show-artifact-tool.js';
import type { TicketLatestRun } from './logic/domain/types/ticket-latest-run.js';
import type { ArtifactFiles } from './logic/ports/artifact-files.js';
import type { ArtifactRepository } from './logic/ports/artifact-repository.js';
import type { TicketRunLookup } from './logic/ports/ticket-run-lookup.js';
import { ListTicketArtifactsUseCase } from './logic/use-cases/list-ticket-artifacts-use-case.js';
import { PublishArtifactUseCase } from './logic/use-cases/publish-artifact-use-case.js';
import { ReadPageAssetUseCase } from './logic/use-cases/read-page-asset-use-case.js';
import { ReadPageStateUseCase } from './logic/use-cases/read-page-state-use-case.js';
import { ReadPageStatusUseCase } from './logic/use-cases/read-page-status-use-case.js';
import { ReadPageUseCase } from './logic/use-cases/read-page-use-case.js';
import { WritePageStateUseCase } from './logic/use-cases/write-page-state-use-case.js';

export type { TicketLatestRun, TicketRunLookup };

export type BridgeModuleDependencies = {
  readonly kitDirectory: string;
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
  readonly ticketRunLookup: TicketRunLookup;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
};

export type BridgeModule = {
  readonly tools: ReadonlyArray<RunTool>;
  readonly kitRoutes: Hono;
  readonly pageRoutes: Hono;
  readonly routes: Hono;
};

export function createBridgeModule(dependencies: BridgeModuleDependencies): BridgeModule {
  const { artifactRepository, artifactFiles, ticketRunLookup, identifiers, clock } = dependencies;

  const publishArtifact = new PublishArtifactUseCase({
    artifactRepository,
    artifactFiles,
    identifiers,
    clock,
  });
  const listTicketArtifacts = new ListTicketArtifactsUseCase({
    artifactRepository,
    ticketRunLookup,
  });

  return {
    tools: [createShowArtifactTool(publishArtifact)],
    kitRoutes: createKitRoutes({ kitDirectory: dependencies.kitDirectory }),
    pageRoutes: createPageRoutes({
      readPage: new ReadPageUseCase({ artifactRepository, artifactFiles }),
      readAsset: new ReadPageAssetUseCase({ artifactRepository, artifactFiles }),
      readStatus: new ReadPageStatusUseCase({ artifactRepository, ticketRunLookup }),
      readState: new ReadPageStateUseCase({ artifactRepository, artifactFiles }),
      writeState: new WritePageStateUseCase({ artifactRepository, artifactFiles }),
    }),
    routes: new Hono().route('/projects', createTicketArtifactsRoutes(listTicketArtifacts)),
  };
}
