import type { AgentTool } from '../../../../shared/agent-tools.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Identifiers } from '../../../../shared/identifiers/identifiers.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import { stageModels } from '../domain/constants/stage-models.js';
import { stageSkills } from '../domain/constants/stage-skills.js';
import { authoringWorktreePathFor } from '../domain/functions/authoring-worktree-path-for.js';
import { branchNameFor } from '../domain/functions/branch-name-for.js';
import { buildCheckpointResumePrompt } from '../domain/functions/build-checkpoint-resume-prompt.js';
import { buildResumePrompt } from '../domain/functions/build-resume-prompt.js';
import { buildStartPrompt } from '../domain/functions/build-start-prompt.js';
import { commandToLabel } from '../domain/functions/command-to-label.js';
import { describeError } from '../domain/functions/describe-error.js';
import { runStageFor } from '../domain/functions/run-stage-for.js';
import { worktreePathFor } from '../domain/functions/worktree-path-for.js';
import type { PermissionRequest } from '../domain/types/permission-request.js';
import type { PermissionVerdict } from '../domain/types/permission-verdict.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { RunWaitOutcome } from '../domain/types/run-wait-outcome.js';
import type { RunWait } from '../domain/types/run-wait.js';
import type { Run } from '../domain/types/run.js';
import type { SessionEntry } from '../domain/types/session-entry.js';
import type { SessionEvent, WindowRefusal } from '../domain/types/session-event.js';
import type { SessionLaunch } from '../domain/types/session-launch.js';
import type { SessionSpec } from '../domain/types/session-spec.js';
import type { SessionTool } from '../domain/types/session-tool.js';
import type { StartRunRequest } from '../domain/types/start-run-request.js';
import { RunNotResumableError } from '../errors/run-not-resumable-error.js';
import { RunTargetNotFoundError } from '../errors/run-target-not-found-error.js';
import type { RunAnswerWaits } from '../port/repository/run-answer-waits.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { AgentSessions } from '../port/session/agent-sessions.js';
import type { SessionFeed } from '../port/session/session-feed.js';
import type { RunTranscripts } from '../port/transcript/run-transcripts.js';
import type { ProjectPort } from '../port/project/project-port.js';
import type { Worktrees } from '../port/worktree/worktrees.js';
import type { CommandLabelService } from './command-label-service.js';
import type { RunEndService } from './run-end-service.js';

export type RunStartServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly worktrees: Worktrees;
  readonly projectPort: ProjectPort;
  readonly agentSessions: AgentSessions;
  readonly runTranscripts: RunTranscripts;
  readonly sessionFeed: SessionFeed;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
  readonly events: EventPublisher;
  readonly logger: Logger;
  readonly runEndService: Pick<RunEndService, 'finish'>;
  readonly commandLabelService: Pick<CommandLabelService, 'labelFor'>;
  readonly tools: () => ReadonlyArray<AgentTool>;
  readonly worktreesDirectory: string;
  readonly windowMilliseconds: number;
};

const refusalFallbackMilliseconds = 3_600_000;

const refusalMessage = 'A human refused this tool call. Do not retry it; carry on without it.';

function answerText(answer: RunAnswer): string {
  return answer.kind === 'checkpoint' ? answer.text : answer.decision;
}

/** Only entries and text deltas go onto the session feed; run endings do not. */
function goesOnFeed(event: SessionEvent): boolean {
  return event.kind === 'entry' || event.kind === 'text-delta';
}

/** Starts and resumes runs, launches their agent session and holds them for a human's answer. */
export class RunStartService {
  constructor(private readonly dependencies: RunStartServiceDependencies) {}

  async start(request: StartRunRequest): Promise<Run> {
    const { runRepository, worktrees, projectPort, identifiers, clock, events, runEndService } =
      this.dependencies;

    const target = await projectPort.find(request.projectId, request.ticketNumber);
    if (target === undefined) {
      throw new RunTargetNotFoundError(
        `Ticket #${request.ticketNumber} of ${request.projectId} is unknown`,
      );
    }

    const stage = runStageFor(request);
    const authoring = stage === 'create' || stage === 'plan';
    const worktreePath = (authoring ? authoringWorktreePathFor : worktreePathFor)(
      this.dependencies.worktreesDirectory,
      target.repositoryName,
      request.ticketNumber,
    );
    const run: Run = {
      id: identifiers.next(),
      projectId: request.projectId,
      ticketNumber: request.ticketNumber,
      stage,
      mode: request.mode,
      sessionId: identifiers.next(),
      worktreePath,
      branchName: authoring ? '' : branchNameFor(request.ticketNumber, request.ticketTitle),
      state: 'running',
      startedAt: clock.now(),
    };
    const latestRun = await runRepository.findLatest(request.projectId, request.ticketNumber);
    await runRepository.insert(run);
    events.emit('run.started', {
      runId: run.id,
      projectId: run.projectId,
      ticketNumber: run.ticketNumber,
    });

    try {
      if (authoring) {
        await worktrees.ensureDetached({
          checkoutPath: target.checkoutPath,
          worktreePath: run.worktreePath,
        });
      } else {
        await worktrees.ensure({
          checkoutPath: target.checkoutPath,
          worktreePath: run.worktreePath,
          branchName: run.branchName,
        });
      }
    } catch (error) {
      await runEndService.finish(run.id, { kind: 'crashed', reason: describeError(error) });
      throw error;
    }

    // The ticket may have closed during setup, which ended the run.
    if (await this.hasEndedMeanwhile(run.id)) {
      return run;
    }

    this.launchSession(run, {
      kind: 'start',
      prompt: buildStartPrompt({
        stage,
        status: request.status,
        ticketNumber: run.ticketNumber,
        latestRunEndedAt: latestRun?.endedAt,
      }),
    });

    return run;
  }

  async resume(runId: string, answer: RunAnswer): Promise<Run> {
    const { runRepository, identifiers, clock, events } = this.dependencies;

    const previousRun = await runRepository.findById(runId);
    const ending = previousRun?.ending;
    if (previousRun === undefined || ending === undefined) {
      throw new RunNotResumableError(`Run ${runId} has no ending to answer`);
    }
    let launch: SessionLaunch;
    if (ending.kind === 'permission-needed' && answer.kind === 'permission') {
      launch = {
        kind: 'resume',
        prompt: buildResumePrompt(ending, answer.decision),
        ...(answer.decision === 'allow'
          ? { allowedCall: { toolName: ending.toolName, toolInput: ending.toolInput } }
          : {}),
      };
    } else if (ending.kind === 'checkpoint' && answer.kind === 'checkpoint') {
      launch = {
        kind: 'resume',
        prompt: buildCheckpointResumePrompt(
          previousRun.ticketNumber,
          ending.request,
          answer.text,
          stageSkills[previousRun.stage],
        ),
      };
    } else {
      throw new RunNotResumableError(`Run ${runId} cannot take a ${answer.kind} answer`);
    }
    const latestRun = await runRepository.findLatest(
      previousRun.projectId,
      previousRun.ticketNumber,
    );
    if (latestRun?.id !== previousRun.id) {
      throw new RunNotResumableError(
        `Run ${runId} is not the latest run of #${previousRun.ticketNumber}`,
      );
    }

    const run: Run = {
      id: identifiers.next(),
      projectId: previousRun.projectId,
      ticketNumber: previousRun.ticketNumber,
      stage: previousRun.stage,
      mode: previousRun.mode,
      sessionId: previousRun.sessionId,
      worktreePath: previousRun.worktreePath,
      branchName: previousRun.branchName,
      state: 'running',
      startedAt: clock.now(),
    };
    await runRepository.insert(run);
    events.emit('run.started', {
      runId: run.id,
      projectId: run.projectId,
      ticketNumber: run.ticketNumber,
    });

    this.launchSession(run, launch);

    return run;
  }

  launchSession(run: Run, launch: SessionLaunch): void {
    const { agentSessions } = this.dependencies;
    const spec = {
      sessionId: run.sessionId,
      worktreePath: run.worktreePath,
      prompt: launch.prompt,
      model: stageModels[run.stage],
      tools: this.bindTools(run),
      decidePermission: this.bindPermission(run),
    };
    const sessionEvents =
      launch.kind === 'start'
        ? agentSessions.start(spec)
        : agentSessions.resume({
            ...spec,
            ...(launch.allowedCall === undefined ? {} : { allowedCall: launch.allowedCall }),
          });
    this.consume(run, sessionEvents).catch((error: unknown) => {
      this.reportFailure(run, error);
    });
  }

  async waitForAnswer(run: Run, wait: RunWait): Promise<RunWaitOutcome> {
    const { runRepository, runAnswerWaits, clock, events, runEndService, windowMilliseconds } =
      this.dependencies;

    const outcome = await runRepository.recordWait(run.id, wait, clock.now());
    if (outcome === 'refused') {
      return {
        kind: 'unanswered',
        message:
          'This run is already waiting for an answer. Do not call this tool again: end your turn.',
      };
    }
    const pendingAnswer = runAnswerWaits.wait(run.id, windowMilliseconds);
    events.emit('run.waiting', {
      runId: run.id,
      projectId: run.projectId,
      ticketNumber: run.ticketNumber,
      stage: run.stage,
      wait,
    });

    const answer = await pendingAnswer;
    switch (answer.kind) {
      case 'answered':
        await runRepository.clearWait(run.id);
        events.emit('run.wait-cleared', {
          runId: run.id,
          projectId: run.projectId,
          ticketNumber: run.ticketNumber,
        });
        return { kind: 'answered', answer: answer.answer };
      case 'expired':
        await runEndService.finish(run.id, wait);
        return {
          kind: 'unanswered',
          message:
            'The answer window has passed. End your turn: the app resumes this session when the human answers.',
        };
      case 'cancelled':
        return { kind: 'unanswered', message: 'The run has ended. End your turn.' };
    }
  }

  private bindTools(run: Run): ReadonlyArray<SessionTool> {
    const runContext = {
      runId: run.id,
      projectId: run.projectId,
      ticketNumber: run.ticketNumber,
      worktreePath: run.worktreePath,
    };
    return this.dependencies.tools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputShape: tool.inputShape,
      execute: async (input) => {
        const currentRun = await this.dependencies.runRepository.findById(run.id);
        if (currentRun?.state !== 'running') {
          return 'This run has ended. The tool did not run. End your turn.';
        }
        const result = await tool.execute(input, runContext);
        if ('wait' in result) {
          const outcome = await this.waitForAnswer(run, result.wait);
          return outcome.kind === 'answered' ? answerText(outcome.answer) : outcome.message;
        }
        if (result.ending !== undefined) {
          await this.dependencies.runEndService.finish(run.id, result.ending);
        }
        return result.text;
      },
    }));
  }

  private bindPermission(run: Run): SessionSpec['decidePermission'] {
    let queue: Promise<unknown> = Promise.resolve();
    return (request) => {
      const verdict = queue.then(() => this.waitForPermission(run, request));
      queue = verdict.catch(() => undefined);
      return verdict;
    };
  }

  private async waitForPermission(
    run: Run,
    request: PermissionRequest,
  ): Promise<PermissionVerdict> {
    const outcome = await this.waitForAnswer(run, {
      kind: 'permission-needed',
      ...request,
    });
    if (outcome.kind === 'unanswered') {
      return { kind: 'deny', message: outcome.message };
    }
    return outcome.answer.kind === 'permission' && outcome.answer.decision === 'allow'
      ? { kind: 'allow' }
      : { kind: 'deny', message: refusalMessage };
  }

  private async consume(run: Run, sessionEvents: AsyncIterable<SessionEvent>): Promise<void> {
    const { runEndService, sessionFeed, events, clock } = this.dependencies;
    let promptPulled = false;
    try {
      for await (const event of sessionEvents) {
        // The prompt comes first on the feed. The transcript holds it by the first stream event.
        if (goesOnFeed(event) && !promptPulled) {
          promptPulled = true;
          await this.publishPrompt(run);
        }
        switch (event.kind) {
          case 'entry':
            this.startLabelling(run, event.entry);
            sessionFeed.publish(run.id, event);
            break;
          case 'text-delta':
            sessionFeed.publish(run.id, event);
            break;
          case 'completed':
            await runEndService.finish(run.id, { kind: 'finished' });
            break;
          case 'window-observed': {
            const refusedUntil = this.refusedUntil(event.refusal);
            events.emit('usage.window-observed', {
              observedAt: clock.now(),
              fiveHour: event.fiveHour,
              sevenDay: event.sevenDay,
              refusedUntil,
            });
            if (event.refusal !== null && refusedUntil !== null) {
              await runEndService.finish(run.id, {
                kind: 'usage-limit',
                reason: `The ${event.refusal.window} usage limit was reached (resets at ${refusedUntil})`,
              });
              return;
            }
            break;
          }
          case 'crashed':
            await runEndService.finish(run.id, { kind: 'crashed', reason: event.reason });
            break;
        }
      }
    } catch (error) {
      // A session that throws must still end its run.
      this.reportFailure(run, error);
      await runEndService.finish(run.id, { kind: 'crashed', reason: describeError(error) });
    } finally {
      sessionFeed.end(run.id);
    }
  }

  /** A refusal without a reset time is retried in an hour. No refusal: null. */
  private refusedUntil(refusal: WindowRefusal | null): string | null {
    if (refusal === null) {
      return null;
    }
    return (
      refusal.resetsAt ??
      new Date(
        Date.parse(this.dependencies.clock.now()) + refusalFallbackMilliseconds,
      ).toISOString()
    );
  }

  /** Labels the entry's command without waiting. A failure is logged and never ends the run. */
  private startLabelling(run: Run, entry: SessionEntry): void {
    const command = commandToLabel(entry);
    if (command === undefined) {
      return;
    }
    this.dependencies.commandLabelService.labelFor(command).catch((error: unknown) => {
      this.reportFailure(run, error);
    });
  }

  /** The prompt is on disk by the first stream event. A failed read is logged and skipped. */
  private async publishPrompt(run: Run): Promise<void> {
    const { runTranscripts, sessionFeed } = this.dependencies;
    try {
      const entries = await runTranscripts.readEntries(run.sessionId, run.worktreePath);
      const prompt = entries.findLast((entry) => entry.kind === 'prompt');
      if (prompt !== undefined) {
        sessionFeed.publish(run.id, { kind: 'entry', entry: prompt });
      }
    } catch (error) {
      this.reportFailure(run, error);
    }
  }

  private reportFailure(run: Run, error: unknown): void {
    this.dependencies.logger.error(`Run ${run.id} failed: ${describeError(error)}`);
  }

  private async hasEndedMeanwhile(runId: string): Promise<boolean> {
    const current = await this.dependencies.runRepository.findById(runId);
    return current?.state !== 'running';
  }
}
