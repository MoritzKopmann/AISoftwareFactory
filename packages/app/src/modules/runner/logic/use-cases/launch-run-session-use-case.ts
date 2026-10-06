import type { Logger } from '../../../../shared/logger/create-logger.js';
import { stageModels } from '../domain/constants/stage-models.js';
import { describeError } from '../domain/functions/describe-error.js';
import type { FinishRun } from '../domain/types/finish-run.js';
import type { Run } from '../domain/types/run.js';
import type { RunTool } from '../domain/types/run-tool.js';
import type { SessionEvent } from '../domain/types/session-event.js';
import type { SessionLaunch } from '../domain/types/session-launch.js';
import type { SessionTool } from '../domain/types/session-tool.js';
import type { RunWait } from '../domain/types/run-wait.js';
import type { AgentSessions } from '../ports/agent-sessions.js';
import type { RecentRunSteps } from '../ports/recent-run-steps.js';
import type { RunRepository } from '../ports/run-repository.js';

export type LaunchRunSessionDependencies = {
  readonly agentSessions: AgentSessions;
  readonly recentRunSteps: RecentRunSteps;
  readonly runRepository: RunRepository;
  readonly finishRun: FinishRun;
  readonly waitForRunAnswer: (run: Run, wait: RunWait) => Promise<string>;
  readonly tools: ReadonlyArray<RunTool>;
  readonly logger: Logger;
};

export class LaunchRunSessionUseCase {
  constructor(private readonly dependencies: LaunchRunSessionDependencies) {}

  execute(run: Run, launch: SessionLaunch): void {
    const { agentSessions } = this.dependencies;
    const spec = {
      sessionId: run.sessionId,
      worktreePath: run.worktreePath,
      prompt: launch.prompt,
      model: stageModels[run.stage],
      tools: this.bindTools(run),
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

  private bindTools(run: Run): ReadonlyArray<SessionTool> {
    const runContext = {
      runId: run.id,
      projectId: run.projectId,
      ticketNumber: run.ticketNumber,
      worktreePath: run.worktreePath,
    };
    return this.dependencies.tools.map((tool) => ({
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
          return this.dependencies.waitForRunAnswer(run, result.wait);
        }
        if (result.ending !== undefined) {
          await this.dependencies.finishRun(run.id, result.ending);
        }
        return result.text;
      },
    }));
  }

  private async consume(run: Run, sessionEvents: AsyncIterable<SessionEvent>): Promise<void> {
    const { finishRun, recentRunSteps } = this.dependencies;
    try {
      for await (const event of sessionEvents) {
        switch (event.kind) {
          case 'step':
            recentRunSteps.append(run.id, event.step);
            break;
          case 'completed':
            await finishRun(run.id, { kind: 'finished' });
            break;
          case 'permission-needed':
            await finishRun(run.id, {
              kind: 'permission-needed',
              toolName: event.toolName,
              toolInput: event.toolInput,
            });
            break;
          case 'usage-limit':
            await finishRun(run.id, { kind: 'usage-limit', reason: event.reason });
            break;
          case 'crashed':
            await finishRun(run.id, { kind: 'crashed', reason: event.reason });
            break;
        }
      }
    } catch (error) {
      // A session that throws must still end its run.
      this.reportFailure(run, error);
      await finishRun(run.id, { kind: 'crashed', reason: describeError(error) });
    }
  }

  private reportFailure(run: Run, error: unknown): void {
    this.dependencies.logger.error(`Run ${run.id} failed: ${describeError(error)}`);
  }
}
