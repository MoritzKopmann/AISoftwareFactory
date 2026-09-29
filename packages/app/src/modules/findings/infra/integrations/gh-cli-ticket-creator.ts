import { runProcess } from '../../../../shared/process/run-process.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import { TicketCreationFailedError } from '../../logic/errors/ticket-creation-failed-error.js';
import type { TicketCreator } from '../../logic/ports/ticket-creator.js';

const commandTimeoutMilliseconds = 30_000;

export class GhCliTicketCreator implements TicketCreator {
  async create(
    repository: RepositoryReference,
    ticket: { readonly title: string; readonly body: string },
  ): Promise<number> {
    const result = await runProcess(
      'gh',
      [
        'issue',
        'create',
        '--title',
        ticket.title,
        '--body',
        ticket.body,
        '--repo',
        `${repository.owner}/${repository.name}`,
      ],
      { timeoutMilliseconds: commandTimeoutMilliseconds },
    );
    if (result.exitCode !== 0) {
      throw new TicketCreationFailedError(result.standardError.trim() || 'gh issue create failed');
    }
    const createdNumber = /\/issues\/(\d+)\s*$/.exec(result.standardOutput)?.[1];
    if (createdNumber === undefined) {
      throw new TicketCreationFailedError('gh issue create did not print the new issue URL');
    }
    return Number(createdNumber);
  }
}
