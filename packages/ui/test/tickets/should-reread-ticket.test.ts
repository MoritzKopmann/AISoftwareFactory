import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { shouldRereadTicket } from '../../src/tickets/should-reread-ticket.js';

const lastRun: NonNullable<TicketRunResponse['lastRun']> = {
  id: 'run-1',
  startedAt: '2026-09-30T09:41:00Z',
  endedAt: '2026-09-30T09:47:00Z',
  ending: { kind: 'stopped' },
};
const ended: TicketRunResponse = { availability: { kind: 'available' }, lastRun };
const live: TicketRunResponse = {
  ...ended,
  activeRun: { id: 'run-2', startedAt: '2026-09-30T09:50:00Z', steps: [] },
};
const permissionStop: TicketRunResponse = {
  ...ended,
  lastRun: {
    ...lastRun,
    ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'ls' } },
  },
};

describe('shouldRereadTicket', () => {
  it('should re-read when the ticket still shows in progress but its run has ended', () => {
    expect(shouldRereadTicket(ended, 'in-progress')).toBe(true);
  });

  it('should not re-read when a run is active and the ticket shows in progress', () => {
    expect(shouldRereadTicket(live, 'in-progress')).toBe(false);
  });

  it('should re-read when a run is active but the ticket does not show in progress yet', () => {
    expect(shouldRereadTicket(live, 'ready')).toBe(true);
  });

  it('should not re-read when the ended run did not need permission and the ticket shows stuck', () => {
    expect(shouldRereadTicket(ended, 'stuck')).toBe(false);
  });

  it('should not re-read when the ticket never had a run', () => {
    expect(shouldRereadTicket({ availability: { kind: 'absent' } }, 'in-progress')).toBe(false);
  });

  it('should not re-read when no answer has arrived yet', () => {
    expect(shouldRereadTicket(undefined, 'in-progress')).toBe(false);
  });

  it('should re-read when a checkpoint run ended but the ticket still shows in progress', () => {
    const checkpoint: TicketRunResponse = {
      availability: { kind: 'absent' },
      lastRun: { ...lastRun, ending: { kind: 'checkpoint', request: 'Check the board.' } },
    };
    expect(shouldRereadTicket(checkpoint, 'in-progress')).toBe(true);
  });

  it('should not re-read when a checkpoint run ended and the ticket shows waiting', () => {
    const checkpoint: TicketRunResponse = {
      availability: { kind: 'absent' },
      lastRun: { ...lastRun, ending: { kind: 'checkpoint', request: 'Check the board.' } },
    };
    expect(shouldRereadTicket(checkpoint, 'waiting')).toBe(false);
  });

  it('should re-read when the answered run resumed but the ticket still shows waiting', () => {
    expect(shouldRereadTicket(live, 'waiting')).toBe(true);
  });

  it('should re-read when a permission stop ended the run and the ticket does not show stuck yet', () => {
    expect(shouldRereadTicket(permissionStop, 'ready')).toBe(true);
  });

  it('should not re-read when a permission stop ended the run and the ticket shows stuck', () => {
    expect(shouldRereadTicket(permissionStop, 'stuck')).toBe(false);
  });

  it('should not re-read when the ticket shows closed', () => {
    expect(shouldRereadTicket(permissionStop, 'closed')).toBe(false);
  });
});

describe('shouldRereadTicket during a live wait', () => {
  const waitingRun: TicketRunResponse = {
    ...ended,
    activeRun: {
      id: 'run-2',
      startedAt: '2026-09-30T09:50:00Z',
      steps: [],
      waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
    },
  };

  it('should not re-read when the run waits and the ticket shows waiting', () => {
    expect(shouldRereadTicket(waitingRun, 'waiting')).toBe(false);
  });

  it('should re-read when the run waits and the ticket still shows in progress', () => {
    expect(shouldRereadTicket(waitingRun, 'in-progress')).toBe(true);
  });

  it('should re-read when the run works and the ticket shows waiting', () => {
    expect(shouldRereadTicket(live, 'waiting')).toBe(true);
  });
});
