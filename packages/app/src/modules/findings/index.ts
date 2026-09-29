import type { Clock } from '../../shared/clock/clock.js';
import type { RunTool } from '../runner/index.js';
import { createReportFindingTool } from './api/tools/create-report-finding-tool.js';
import type { Finding } from './logic/domain/types/finding.js';
import { FindingNotFoundError } from './logic/errors/finding-not-found-error.js';
import { FindingNotOpenError } from './logic/errors/finding-not-open-error.js';
import type { FindingRepository } from './logic/ports/finding-repository.js';
import type { ProjectLookup } from './logic/ports/project-lookup.js';
import type { TicketCreator } from './logic/ports/ticket-creator.js';
import { CreateTicketFromFindingUseCase } from './logic/use-cases/create-ticket-from-finding-use-case.js';
import { DismissFindingUseCase } from './logic/use-cases/dismiss-finding-use-case.js';
import { ListFindingsUseCase } from './logic/use-cases/list-findings-use-case.js';
import { ReportFindingUseCase } from './logic/use-cases/report-finding-use-case.js';

export type { Finding, FindingKind, FindingState } from './logic/domain/types/finding.js';
export { FindingNotFoundError, FindingNotOpenError };

export type FindingsModuleDependencies = {
  readonly findingRepository: FindingRepository;
  readonly ticketCreator: TicketCreator;
  readonly projectLookup: ProjectLookup;
  readonly clock: Clock;
};

export type FindingsModule = {
  readonly tools: ReadonlyArray<RunTool>;
  readonly list: (projectId: string, ticketNumber?: number) => Promise<ReadonlyArray<Finding>>;
  readonly createTicket: (projectId: string, findingId: number) => Promise<Finding>;
  readonly dismiss: (projectId: string, findingId: number) => Promise<Finding>;
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
    list: (projectId, ticketNumber) => listFindings.execute(projectId, ticketNumber),
    createTicket: (projectId, findingId) => createTicketFromFinding.execute(projectId, findingId),
    dismiss: (projectId, findingId) => dismissFinding.execute(projectId, findingId),
  };
}
