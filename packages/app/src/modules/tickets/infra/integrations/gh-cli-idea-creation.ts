import { runProcess } from '../../../../shared/process/run-process.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import { IdeaCreationFailedError } from '../../logic/errors/idea-creation-failed-error.js';
import type { IdeaCreation } from '../../logic/ports/idea-creation.js';

const commandTimeoutMilliseconds = 30_000;

export class GhCliIdeaCreation implements IdeaCreation {
  async create(
    repository: RepositoryReference,
    idea: { readonly title: string; readonly body: string },
  ): Promise<number> {
    const result = await runProcess(
      'gh',
      [
        'issue',
        'create',
        '--title',
        idea.title,
        '--body',
        idea.body,
        '--repo',
        `${repository.owner}/${repository.name}`,
      ],
      { timeoutMilliseconds: commandTimeoutMilliseconds },
    );
    if (result.exitCode !== 0) {
      throw new IdeaCreationFailedError(result.standardError.trim() || 'gh issue create failed');
    }
    const createdNumber = /\/issues\/(\d+)\s*$/.exec(result.standardOutput)?.[1];
    if (createdNumber === undefined) {
      throw new IdeaCreationFailedError('gh issue create did not print the new issue URL');
    }
    return Number(createdNumber);
  }
}
