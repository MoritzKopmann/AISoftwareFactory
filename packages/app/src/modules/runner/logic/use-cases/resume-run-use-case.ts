import type { Clock } from '../../../../shared/clock/clock.js';
import { stageSkills } from '../domain/constants/stage-skills.js';
import { buildCheckpointResumePrompt } from '../domain/functions/build-checkpoint-resume-prompt.js';
import { buildResumePrompt } from '../domain/functions/build-resume-prompt.js';
import type { LaunchRunSession } from '../domain/types/launch-run-session.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { SessionLaunch } from '../domain/types/session-launch.js';
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

  async execute(runId: string, answer: RunAnswer): Promise<Run> {
    const { runRepository, identifiers, clock, launchRunSession } = this.dependencies;

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

    launchRunSession(run, launch);

    return run;
  }
}
