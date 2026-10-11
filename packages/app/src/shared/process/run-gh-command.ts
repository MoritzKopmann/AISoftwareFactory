import { runProcess } from './run-process.js';

const commandTimeoutMilliseconds = 30_000;

export async function runGhCommand(
  repository: { readonly owner: string; readonly name: string },
  argumentList: ReadonlyArray<string>,
  createError: (message: string) => Error,
): Promise<string> {
  const result = await runProcess(
    'gh',
    [...argumentList, '--repo', `${repository.owner}/${repository.name}`],
    { timeoutMilliseconds: commandTimeoutMilliseconds },
  );
  if (result.exitCode !== 0) {
    throw createError(
      result.standardError.trim() || `gh ${argumentList.slice(0, 2).join(' ')} failed`,
    );
  }
  return result.standardOutput;
}
