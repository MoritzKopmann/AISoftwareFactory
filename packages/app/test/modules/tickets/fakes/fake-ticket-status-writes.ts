import type { RepositoryReference } from '../../../../src/modules/tickets/logic/domain/types/repository-reference.js';
import type { TicketLiveState } from '../../../../src/modules/tickets/logic/domain/types/ticket-live-state.js';
import type { ActiveRunLookup } from '../../../../src/modules/tickets/logic/ports/active-run-lookup.js';
import type { RunSettlement } from '../../../../src/modules/tickets/logic/ports/run-settlement.js';
import type { TicketStatusWrites } from '../../../../src/modules/tickets/logic/ports/ticket-status-writes.js';
import type { TicketStatus } from '../../../../src/shared/ticket-status/ticket-status.js';

export class FakeTicketStatusWrites implements TicketStatusWrites {
  readonly calls: string[] = [];
  liveStatus: TicketStatus = 'in-progress';
  liveWaiting = false;
  liveStuck = false;
  setStatusFailure: Error | undefined;

  async readState(): Promise<TicketLiveState> {
    this.calls.push('readState');
    return { status: this.liveStatus, waiting: this.liveWaiting, stuck: this.liveStuck };
  }

  async setSecondaryState(
    _repository: RepositoryReference,
    ticketNumber: number,
    state: 'waiting' | 'stuck',
    on: boolean,
  ): Promise<void> {
    this.calls.push(`setSecondaryState #${ticketNumber} ${state} ${on ? 'on' : 'off'}`);
    if (this.setStatusFailure !== undefined) {
      throw this.setStatusFailure;
    }
    if (state === 'waiting') {
      this.liveWaiting = on;
    } else {
      this.liveStuck = on;
    }
  }

  async setStatus(
    _repository: RepositoryReference,
    ticketNumber: number,
    to: TicketStatus,
  ): Promise<void> {
    this.calls.push(`setStatus #${ticketNumber} -> ${to}`);
    if (this.setStatusFailure !== undefined) {
      throw this.setStatusFailure;
    }
    this.liveStatus = to;
  }

  async comment(
    _repository: RepositoryReference,
    ticketNumber: number,
    body: string,
  ): Promise<void> {
    this.calls.push(`comment #${ticketNumber}: ${body}`);
  }
}

export class FakeRunSettlement implements RunSettlement {
  readonly calls: string[] = [];

  async settle(runId: string): Promise<void> {
    this.calls.push(`settle ${runId}`);
  }
}

export class FakeActiveRunLookup implements ActiveRunLookup {
  activeTicketNumbers: ReadonlyArray<number> = [];

  async activeRunTicketNumbers(): Promise<ReadonlyArray<number>> {
    return this.activeTicketNumbers;
  }
}
