import { GhCommandFailedError } from '../../../../shared/github/gh-command-failed-error.js';
import { runGhCommand } from '../../../../shared/github/run-gh-command.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import { TicketCreationFailedError } from '../../logic/errors/ticket-creation-failed-error.js';
import type { TicketCreator } from '../../logic/ports/ticket-creator.js';

export class GhCliTicketCreator implements TicketCreator {
  async create(
    repository: RepositoryReference,
    ticket: { readonly title: string; readonly body: string },
  ): Promise<number> {
    let standardOutput: string;
    try {
      standardOutput = await runGhCommand(
        ['issue', 'create', '--title', ticket.title, '--body', ticket.body],
        { repository },
      );
    } catch (error) {
      if (error instanceof GhCommandFailedError) {
        throw new TicketCreationFailedError(error.message);
      }
      throw error;
    }
    const createdNumber = /\/issues\/(\d+)\s*$/.exec(standardOutput)?.[1];
    if (createdNumber === undefined) {
      throw new TicketCreationFailedError('gh issue create did not print the new issue URL');
    }
    return Number(createdNumber);
  }
}
