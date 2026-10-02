import { runProcess, type ProcessResult } from '../../../../shared/process/run-process.js';
import { aisfLabels } from '../../logic/domain/constants/aisf-labels.js';
import { findMissingLabels } from '../../logic/domain/functions/find-missing-labels.js';
import { GitHubCliError } from '../../logic/errors/github-cli-error.js';
import type { LabelSync } from '../../logic/ports/label-sync.js';
import type { RepositoryReference } from '../../logic/ports/repository-resolver.js';

const commandTimeoutMilliseconds = 30_000;
const labelListLimit = 1000;

type LabelListEntry = { readonly name: string };

async function runGh(argumentList: ReadonlyArray<string>): Promise<ProcessResult> {
  try {
    return await runProcess('gh', argumentList, {
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
  } catch (error) {
    throw new GitHubCliError(error instanceof Error ? error.message : String(error));
  }
}

export class GhCliLabelSync implements LabelSync {
  async sync(repository: RepositoryReference): Promise<void> {
    const repositorySlug = `${repository.owner}/${repository.name}`;

    const labelList = await runGh([
      'label',
      'list',
      '--repo',
      repositorySlug,
      '--json',
      'name',
      '-L',
      String(labelListLimit),
    ]);
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
      const labelCreate = await runGh([
        'label',
        'create',
        label.name,
        '--repo',
        repositorySlug,
        '-c',
        label.color,
        '-d',
        label.description,
      ]);
      if (labelCreate.exitCode !== 0) {
        throw new GitHubCliError(labelCreate.standardError.trim() || 'gh label create failed');
      }
    }
  }
}
