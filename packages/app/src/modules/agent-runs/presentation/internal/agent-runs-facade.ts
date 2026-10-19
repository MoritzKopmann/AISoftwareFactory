import type { Run } from '../../business/domain/types/run.js';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import { RunNotResumableError } from '../../business/errors/run-not-resumable-error.js';
import type { RunAnswerService } from '../../business/service/run-answer-service.js';
import type { RunEndService } from '../../business/service/run-end-service.js';
import type { RunQueryService } from '../../business/service/run-query-service.js';
import type { RunStartService } from '../../business/service/run-start-service.js';
import type { ActiveRunDto } from '../dto/internal/active-run-dto.js';
import type { ActiveWaitDto } from '../dto/internal/active-wait-dto.js';
import type { AnswerRunResultDto } from '../dto/internal/answer-run-result-dto.js';
import type { PausedRunDto } from '../dto/internal/paused-run-dto.js';
import type { RunAnswerDto } from '../dto/internal/run-answer-dto.js';
import type { RunDto } from '../dto/internal/run-dto.js';
import type { StartRunRequestDto } from '../dto/internal/start-run-request-dto.js';
import type { StartRunResultDto } from '../dto/internal/start-run-result-dto.js';
import {
  toActiveRunDto,
  toActiveWaitDto,
  toPausedRunDto,
  toRunAnswer,
  toRunDto,
  toStartRunRequest,
} from '../dto/mapper/run-mapper.js';
import type { AgentRunsApi } from './agent-runs-api.js';

export type AgentRunsFacadeServices = {
  readonly runStartService: RunStartService;
  readonly runEndService: RunEndService;
  readonly runAnswerService: RunAnswerService;
  readonly runQueryService: RunQueryService;
};

export class AgentRunsFacade implements AgentRunsApi {
  constructor(private readonly services: AgentRunsFacadeServices) {}

  async start(request: StartRunRequestDto): Promise<StartRunResultDto> {
    try {
      const run = await this.services.runStartService.start(toStartRunRequest(request));
      return { kind: 'started', run: toRunDto(run) };
    } catch (error) {
      if (error instanceof RunAlreadyActiveError) {
        return { kind: 'already-active', message: error.message };
      }
      throw error;
    }
  }

  answer(runId: string, answer: RunAnswerDto): Promise<AnswerRunResultDto> {
    return this.toAnswerResult(() =>
      this.services.runAnswerService.deliverAnswer(runId, toRunAnswer(answer)),
    );
  }

  resumePaused(runId: string): Promise<AnswerRunResultDto> {
    return this.toAnswerResult(() => this.services.runStartService.resumePaused(runId));
  }

  holdAnswer(runId: string, answer: RunAnswerDto): Promise<void> {
    return this.services.runAnswerService.holdAnswer(runId, toRunAnswer(answer));
  }

  async pausedRuns(projectId: string): Promise<ReadonlyArray<PausedRunDto>> {
    return (await this.services.runQueryService.pausedRuns(projectId)).map(toPausedRunDto);
  }

  async findRun(runId: string): Promise<RunDto | undefined> {
    const run = await this.services.runQueryService.read(runId);
    return run === undefined ? undefined : toRunDto(run);
  }

  async activeRuns(projectId: string): Promise<ReadonlyArray<ActiveRunDto>> {
    return (await this.services.runQueryService.readActive(projectId)).map(toActiveRunDto);
  }

  async activeWaits(projectId: string): Promise<ReadonlyArray<ActiveWaitDto>> {
    return (await this.services.runQueryService.readActiveWaits(projectId)).map(toActiveWaitDto);
  }

  async latestRun(projectId: string, ticketNumber: number): Promise<RunDto | undefined> {
    const run = await this.services.runQueryService.readLatest(projectId, ticketNumber);
    return run === undefined ? undefined : toRunDto(run);
  }

  settle(runId: string): Promise<void> {
    return this.services.runEndService.settle(runId);
  }

  private async toAnswerResult(resume: () => Promise<Run>): Promise<AnswerRunResultDto> {
    try {
      return { kind: 'answered', run: toRunDto(await resume()) };
    } catch (error) {
      if (error instanceof RunAlreadyActiveError) {
        return { kind: 'already-active', message: error.message };
      }
      if (error instanceof RunNotResumableError) {
        return { kind: 'not-resumable', message: error.message };
      }
      throw error;
    }
  }
}
