import { runProcess } from '../../../../shared/process/run-process.js';
import { aisfLabels } from '../../logic/domain/constants/aisf-labels.js';
import { findMissingLabels } from '../../logic/domain/functions/find-missing-labels.js';
import { GitHubCliError } from '../../logic/errors/github-cli-error.js';
import type { LabelSync } from '../../logic/ports/label-sync.js';
import type { RepositoryReference } from '../../logic/ports/repository-resolver.js';

const commandTimeoutMilliseconds = 30_000;
const labelListLimit = 1000;

type LabelListEntry = { readonly name: string };

export class GhCliLabelSync implements LabelSync {
  async sync(repository: RepositoryReference): Promise<void> {
    const repositorySlug = `${repository.owner}/${repository.name}`;

    const labelList = await runProcess(
      'gh',
      ['label', 'list', '--repo', repositorySlug, '--json', 'name', '-L', String(labelListLimit)],
      { timeoutMilliseconds: commandTimeoutMilliseconds },
    );
    if (labelList.exitCode !== 0) {
      throw new GitHubCliError(labelList.standardError.trim() || 'gh label list failed');
    }

    let parsedLabelList: unknown;
    try {
      parsedLabelList = JSON.parse(labelList.standardOutput);
    } catch {
      throw new GitHubCliError('gh label list returned unreadable output');
    }
    if (!Array.isArray(parsedLabelList)) {
      throw new GitHubCliError('gh label list returned unreadable output');
    }
    const existingLabels = parsedLabelList as ReadonlyArray<LabelListEntry>;

    const missingLabels = findMissingLabels(
      aisfLabels,
      existingLabels.map((label) => label.name),
    );

    for (const label of missingLabels) {
      const labelCreate = await runProcess(
        'gh',
        [
          'label',
          'create',
          label.name,
          '--repo',
          repositorySlug,
          '-c',
          label.color,
          '-d',
          label.description,
        ],
        { timeoutMilliseconds: commandTimeoutMilliseconds },
      );
      if (labelCreate.exitCode !== 0) {
        throw new GitHubCliError(labelCreate.standardError.trim() || 'gh label create failed');
      }
    }
  }
}
