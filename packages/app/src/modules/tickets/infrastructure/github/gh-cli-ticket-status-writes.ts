import { deriveTicketStatus } from '../../business/domain/functions/derive-ticket-status.js';
import { deriveSecondaryStates } from '../../business/domain/functions/derive-secondary-states.js';
import type { TicketLiveState } from '../../business/domain/types/ticket-live-state.js';
import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';
import type { RepositoryReference } from '../../business/domain/types/repository-reference.js';
import { TicketWriteFailedError } from '../../business/errors/ticket-write-failed-error.js';
import type { TicketStatusWrites } from '../../business/port/github/ticket-status-writes.js';
import { runGhCommand } from '../../../../shared/process/run-gh-command.js';

const statusLabelPrefix = 'status: ';

type LiveTicket = {
  readonly labels: ReadonlyArray<{ readonly name: string }>;
  readonly state: string;
};

export class GhCliTicketStatusWrites implements TicketStatusWrites {
  async readState(repository: RepositoryReference, ticketNumber: number): Promise<TicketLiveState> {
    const liveTicket = await this.readLiveTicket(repository, ticketNumber);
    const labelNames = labelNamesOf(liveTicket);
    return {
      status: deriveTicketStatus({
        state: liveTicket.state === 'CLOSED' ? 'closed' : 'open',
        labelNames,
      }).status,
      ...deriveSecondaryStates({ labelNames }),
    };
  }

  async setStatus(
    repository: RepositoryReference,
    ticketNumber: number,
    to: TicketStatus,
  ): Promise<void> {
    const liveTicket = await this.readLiveTicket(repository, ticketNumber);
    const statusLabels = labelNamesOf(liveTicket).filter((name) =>
      name.startsWith(statusLabelPrefix),
    );
    await this.runGh(repository, [
      'issue',
      'edit',
      String(ticketNumber),
      ...statusLabels.flatMap((label) => ['--remove-label', label]),
      '--add-label',
      `${statusLabelPrefix}${to}`,
    ]);
  }

  async setSecondaryState(
    repository: RepositoryReference,
    ticketNumber: number,
    state: 'waiting' | 'stuck',
    on: boolean,
  ): Promise<void> {
    await this.runGh(repository, [
      'issue',
      'edit',
      String(ticketNumber),
      on ? '--add-label' : '--remove-label',
      state,
    ]);
  }

  async comment(
    repository: RepositoryReference,
    ticketNumber: number,
    body: string,
  ): Promise<void> {
    await this.runGh(repository, ['issue', 'comment', String(ticketNumber), '--body', body]);
  }

  private async readLiveTicket(
    repository: RepositoryReference,
    ticketNumber: number,
  ): Promise<LiveTicket> {
    const standardOutput = await this.runGh(repository, [
      'issue',
      'view',
      String(ticketNumber),
      '--json',
      'labels,state',
    ]);
    try {
      return JSON.parse(standardOutput) as LiveTicket;
    } catch {
      throw new TicketWriteFailedError(`gh issue view #${ticketNumber} returned unreadable output`);
    }
  }

  private runGh(
    repository: RepositoryReference,
    argumentList: ReadonlyArray<string>,
  ): Promise<string> {
    return runGhCommand(repository, argumentList, (message) => new TicketWriteFailedError(message));
  }
}

function labelNamesOf(liveTicket: LiveTicket): ReadonlyArray<string> {
  return liveTicket.labels.map((label) => label.name);
}
