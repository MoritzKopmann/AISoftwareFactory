import { runProcess } from '../../../../shared/process/run-process.js';
import type { IdeaDraft } from '../../business/domain/types/idea-draft.js';
import type { RepositoryReference } from '../../business/domain/types/repository-reference.js';
import { IdeaCreationFailedError } from '../../business/errors/idea-creation-failed-error.js';
import type { IdeaCreation } from '../../business/port/github/idea-creation.js';

const commandTimeoutMilliseconds = 30_000;

function labelArguments(idea: IdeaDraft): ReadonlyArray<string> {
  const labels = [
    ...(idea.status === undefined ? [] : [`status: ${idea.status}`]),
    ...(idea.types ?? []).map((type) => `type: ${type}`),
    ...(idea.priority === undefined ? [] : [`priority: ${idea.priority}`]),
  ];
  return labels.flatMap((label) => ['--label', label]);
}

export class GhCliIdeaCreation implements IdeaCreation {
  async create(repository: RepositoryReference, idea: IdeaDraft): Promise<number> {
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
        ...labelArguments(idea),
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
