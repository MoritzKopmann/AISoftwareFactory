import type { Clock } from '../../../../shared/clock/clock.js';
import { buildResumePrompt } from '../domain/functions/build-resume-prompt.js';
import type { LaunchRunSession } from '../domain/types/launch-run-session.js';
import type { PermissionDecision } from '../domain/types/permission-decision.js';
import type { Run } from '../domain/types/run.js';
import { RunNotResumableError } from '../errors/run-not-resumable-error.js';
import type { Identifiers } from '../ports/identifiers.js';
import type { RunRepository } from '../ports/run-repository.js';

export type ResumeRunDependencies = {
  readonly runRepository: RunRepository;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
  readonly launchRunSession: LaunchRunSession;
};

export class ResumeRunUseCase {
  constructor(private readonly dependencies: ResumeRunDependencies) {}

  async execute(runId: string, decision: PermissionDecision): Promise<Run> {
    const { runRepository, identifiers, clock, launchRunSession } = this.dependencies;

    const previousRun = await runRepository.findById(runId);
    const ending = previousRun?.ending;
    if (previousRun === undefined || ending?.kind !== 'permission-needed') {
      throw new RunNotResumableError(`Run ${runId} did not end needing permission`);
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

    launchRunSession(run, {
      kind: 'resume',
      prompt: buildResumePrompt(ending, decision),
      ...(decision === 'allow'
        ? { allowedCall: { toolName: ending.toolName, toolInput: ending.toolInput } }
        : {}),
    });

    return run;
  }
}
