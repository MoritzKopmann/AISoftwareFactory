import { Hono } from 'hono';
import type { EventPublisher } from '../../shared/bus/event-publisher.js';
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
import type { CheckpointAnswers } from './logic/ports/checkpoint-answers.js';
import type { TicketRunLookup } from './logic/ports/ticket-run-lookup.js';
import { ListTicketArtifactsUseCase } from './logic/use-cases/list-ticket-artifacts-use-case.js';
import { PublishArtifactUseCase } from './logic/use-cases/publish-artifact-use-case.js';
import { ReadPageAssetUseCase } from './logic/use-cases/read-page-asset-use-case.js';
import { ReadPageUserInputStateUseCase } from './logic/use-cases/read-page-user-input-state-use-case.js';
import { ReadPageStatusUseCase } from './logic/use-cases/read-page-status-use-case.js';
import { ReadPageUseCase } from './logic/use-cases/read-page-use-case.js';
import { SubmitPageEventUseCase } from './logic/use-cases/submit-page-event-use-case.js';
import { WritePageUserInputStateUseCase } from './logic/use-cases/write-page-user-input-state-use-case.js';

export { PageBusyError } from './logic/errors/page-busy-error.js';
export type { CheckpointAnswers, TicketLatestRun, TicketRunLookup };

export type ArtifactsModuleDependencies = {
  readonly kitDirectory: string;
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
  readonly ticketRunLookup: TicketRunLookup;
  readonly checkpointAnswers: CheckpointAnswers;
  readonly events: EventPublisher;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
};

export type ArtifactsModule = {
  readonly tools: ReadonlyArray<RunTool>;
  readonly kitRoutes: Hono;
  readonly pageRoutes: Hono;
  readonly routes: Hono;
};

export function createArtifactsModule(dependencies: ArtifactsModuleDependencies): ArtifactsModule {
  const {
    artifactRepository,
    artifactFiles,
    ticketRunLookup,
    checkpointAnswers,
    events,
    identifiers,
    clock,
  } = dependencies;

  const publishArtifact = new PublishArtifactUseCase({
    artifactRepository,
    artifactFiles,
    events,
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
      readUserInputState: new ReadPageUserInputStateUseCase({ artifactRepository, artifactFiles }),
      writeUserInputState: new WritePageUserInputStateUseCase({
        artifactRepository,
        artifactFiles,
      }),
      submitEvent: new SubmitPageEventUseCase({
        artifactRepository,
        ticketRunLookup,
        checkpointAnswers,
      }),
    }),
    routes: new Hono().route('/projects', createTicketArtifactsRoutes(listTicketArtifacts)),
  };
}
