import { GhCommandFailedError } from '../../../../shared/github/gh-command-failed-error.js';
import { runGhCommand } from '../../../../shared/github/run-gh-command.js';
import { aisfLabels } from '../../logic/domain/constants/aisf-labels.js';
import { findMissingLabels } from '../../logic/domain/functions/find-missing-labels.js';
import { LabelSyncFailedError } from '../../logic/errors/label-sync-failed-error.js';
import type { LabelSync } from '../../logic/ports/label-sync.js';
import type { RepositoryReference } from '../../logic/ports/repository-resolver.js';

const labelListLimit = 1000;

type LabelListEntry = { readonly name: string };

async function runGh(
  argumentList: ReadonlyArray<string>,
  repository: RepositoryReference,
): Promise<string> {
  try {
    return await runGhCommand(argumentList, { repository });
  } catch (error) {
    if (error instanceof GhCommandFailedError) {
      throw new LabelSyncFailedError(error.message);
    }
    throw error;
  }
}

export class GhCliLabelSync implements LabelSync {
  async sync(repository: RepositoryReference): Promise<void> {
    const labelList = await runGh(
      ['label', 'list', '--json', 'name', '-L', String(labelListLimit)],
      repository,
    );

    let parsedLabelList: unknown;
    try {
      parsedLabelList = JSON.parse(labelList);
    } catch {
      throw new LabelSyncFailedError('gh label list returned unreadable output');
    }
    if (!Array.isArray(parsedLabelList)) {
      throw new LabelSyncFailedError('gh label list returned unreadable output');
    }
    const existingLabels = parsedLabelList as ReadonlyArray<LabelListEntry>;

    const missingLabels = findMissingLabels(
      aisfLabels,
      existingLabels.map((label) => label.name),
    );

    for (const label of missingLabels) {
      await runGh(
        ['label', 'create', label.name, '-c', label.color, '-d', label.description],
        repository,
      );
    }
  }
}
