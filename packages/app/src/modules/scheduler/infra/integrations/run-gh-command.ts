import { runProcess } from '../../../../shared/process/run-process.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';

const commandTimeoutMilliseconds = 30_000;

export async function runGhCommand(
  repository: RepositoryReference,
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
