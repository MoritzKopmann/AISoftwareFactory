import { runProcess } from '../../../../shared/process/run-process.js';
import { deriveTicketStatus } from '../../../../shared/ticket-status/derive-ticket-status.js';
import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';
import type { RepositoryReference } from '../../logic/domain/types/repository-reference.js';
import { GitHubWriteFailedError } from '../../logic/errors/github-write-failed-error.js';
import type { GitHubWrites, StatusSwapOutcome } from '../../logic/ports/github-writes.js';

const commandTimeoutMilliseconds = 30_000;
const statusLabelPrefix = 'status: ';

type LiveTicket = {
  readonly labels: ReadonlyArray<{ readonly name: string }>;
  readonly state: string;
};

export class GhCliGitHubWrites implements GitHubWrites {
  async readStatus(repository: RepositoryReference, ticketNumber: number): Promise<TicketStatus> {
    const liveTicket = await this.readLiveTicket(repository, ticketNumber);
    return liveStatusOf(liveTicket);
  }

  async transitionStatus(
    repository: RepositoryReference,
    ticketNumber: number,
    allowedFrom: ReadonlyArray<TicketStatus>,
    to: TicketStatus,
  ): Promise<StatusSwapOutcome> {
    const liveTicket = await this.readLiveTicket(repository, ticketNumber);
    const labelNames = labelNamesOf(liveTicket);
    const liveStatus = liveStatusOf(liveTicket);
    const statusLabels = labelNames.filter((name) => name.startsWith(statusLabelPrefix));
    if (!allowedFrom.includes(liveStatus)) {
      return { kind: 'mismatch', actualStatuses: statusLabels };
    }

    await this.runGh(repository, [
      'issue',
      'edit',
      String(ticketNumber),
      ...statusLabels.flatMap((label) => ['--remove-label', label]),
      '--add-label',
      `${statusLabelPrefix}${to}`,
    ]);
    return { kind: 'swapped' };
  }

  async comment(
    repository: RepositoryReference,
    ticketNumber: number,
    body: string,
  ): Promise<void> {
    await this.runGh(repository, ['issue', 'comment', String(ticketNumber), '--body', body]);
  }

  async rebaseMerge(
    repository: RepositoryReference,
    pullRequestNumber: number,
    headCommit: string,
  ): Promise<void> {
    try {
      await this.runGh(repository, [
        'pr',
        'merge',
        String(pullRequestNumber),
        '--rebase',
        '--match-head-commit',
        headCommit,
      ]);
    } catch (error) {
      if (error instanceof GitHubWriteFailedError && /already merged/i.test(error.message)) {
        return;
      }
      throw error;
    }
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
      throw new GitHubWriteFailedError(`gh issue view #${ticketNumber} returned unreadable output`);
    }
  }

  private async runGh(
    repository: RepositoryReference,
    argumentList: ReadonlyArray<string>,
  ): Promise<string> {
    const result = await runProcess(
      'gh',
      [...argumentList, '--repo', `${repository.owner}/${repository.name}`],
      { timeoutMilliseconds: commandTimeoutMilliseconds },
    );
    if (result.exitCode !== 0) {
      throw new GitHubWriteFailedError(
        result.standardError.trim() || `gh ${argumentList.slice(0, 2).join(' ')} failed`,
      );
    }
    return result.standardOutput;
  }
}

function labelNamesOf(liveTicket: LiveTicket): ReadonlyArray<string> {
  return liveTicket.labels.map((label) => label.name);
}

function liveStatusOf(liveTicket: LiveTicket): TicketStatus {
  return deriveTicketStatus({
    state: liveTicket.state === 'CLOSED' ? 'closed' : 'open',
    labelNames: labelNamesOf(liveTicket),
  }).status;
}
