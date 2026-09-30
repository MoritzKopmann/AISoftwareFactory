import { Hono } from 'hono';
import type { Clock } from '../../shared/clock/clock.js';
import type { RunTool } from '../runner/index.js';
import { createFindingsRoutes } from './api/routes/create-findings-routes.js';
import { createReportFindingTool } from './api/tools/create-report-finding-tool.js';
import type { FindingRepository } from './logic/ports/finding-repository.js';
import type { ProjectLookup } from './logic/ports/project-lookup.js';
import type { TicketCreator } from './logic/ports/ticket-creator.js';
import { CreateTicketFromFindingUseCase } from './logic/use-cases/create-ticket-from-finding-use-case.js';
import { DismissFindingUseCase } from './logic/use-cases/dismiss-finding-use-case.js';
import { ListFindingsUseCase } from './logic/use-cases/list-findings-use-case.js';
import { ReportFindingUseCase } from './logic/use-cases/report-finding-use-case.js';

export type FindingsModuleDependencies = {
  readonly findingRepository: FindingRepository;
  readonly ticketCreator: TicketCreator;
  readonly projectLookup: ProjectLookup;
  readonly clock: Clock;
};

export type FindingsModule = {
  readonly tools: ReadonlyArray<RunTool>;
  readonly routes: Hono;
};

export function createFindingsModule(dependencies: FindingsModuleDependencies): FindingsModule {
  const { findingRepository, ticketCreator, projectLookup, clock } = dependencies;

  const reportFinding = new ReportFindingUseCase({ findingRepository, clock });
  const listFindings = new ListFindingsUseCase({ findingRepository });
  const createTicketFromFinding = new CreateTicketFromFindingUseCase({
    findingRepository,
    ticketCreator,
    projectLookup,
    clock,
  });
  const dismissFinding = new DismissFindingUseCase({ findingRepository, clock });

  return {
    tools: [createReportFindingTool(reportFinding)],
    routes: new Hono().route(
      '/projects',
      createFindingsRoutes(listFindings, createTicketFromFinding, dismissFinding),
    ),
  };
}
