import { runProcess, type ProcessResult } from '../process/run-process.js';
import { GhCommandFailedError } from './gh-command-failed-error.js';

const commandTimeoutMilliseconds = 30_000;

export type RunGhCommandOptions = {
  readonly repository?: { readonly owner: string; readonly name: string };
  readonly runCommand?: typeof runProcess;
};

export async function runGhCommand(
  argumentList: ReadonlyArray<string>,
  options: RunGhCommandOptions = {},
): Promise<string> {
  const { repository, runCommand = runProcess } = options;
  const fullArgumentList =
    repository === undefined
      ? argumentList
      : [...argumentList, '--repo', `${repository.owner}/${repository.name}`];

  let result: ProcessResult;
  try {
    result = await runCommand('gh', fullArgumentList, {
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
  } catch (error) {
    throw new GhCommandFailedError(error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }
  if (result.exitCode !== 0) {
    throw new GhCommandFailedError(
      result.standardError.trim() || `gh ${argumentList.slice(0, 2).join(' ')} failed`,
    );
  }
  return result.standardOutput;
}
