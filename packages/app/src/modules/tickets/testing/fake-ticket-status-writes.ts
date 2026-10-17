import type { RepositoryReference } from '../business/domain/types/repository-reference.js';
import type { TicketLiveState } from '../business/domain/types/ticket-live-state.js';
import type { RunPort, RunWait } from '../business/port/run/run-port.js';
import type { TicketStatusWrites } from '../business/port/github/ticket-status-writes.js';
import type { TicketStatus } from '../../../shared/ticket-status/ticket-status.js';

export class FakeTicketStatusWrites implements TicketStatusWrites {
  readonly calls: string[] = [];
  liveStatus: TicketStatus = 'in-progress';
  liveWaiting = false;
  liveStuck = false;
  openSpike = false;
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

  async hasOpenSpike(_repository: RepositoryReference, ticketNumber: number): Promise<boolean> {
    this.calls.push(`hasOpenSpike #${ticketNumber}`);
    return this.openSpike;
  }

  async comment(
    _repository: RepositoryReference,
    ticketNumber: number,
    body: string,
  ): Promise<void> {
    this.calls.push(`comment #${ticketNumber}: ${body}`);
  }
}

export class FakeRunPort implements RunPort {
  readonly calls: string[] = [];
  activeTicketNumbers: ReadonlyArray<number> = [];
  waits: ReadonlyArray<RunWait> = [];

  async activeRunTicketNumbers(): Promise<ReadonlyArray<number>> {
    return this.activeTicketNumbers;
  }

  async settle(runId: string): Promise<void> {
    this.calls.push(`settle ${runId}`);
  }

  async waitsOf(): Promise<ReadonlyArray<RunWait>> {
    return this.waits;
  }
}
