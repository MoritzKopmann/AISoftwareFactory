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

  it('should not re-read when the ticket already left in progress', () => {
    expect(shouldRereadTicket(ended, 'stuck')).toBe(false);
  });

  it('should not re-read when the ticket never had a run', () => {
    expect(shouldRereadTicket({ availability: { kind: 'absent' } }, 'in-progress')).toBe(false);
  });

  it('should not re-read when no answer has arrived yet', () => {
    expect(shouldRereadTicket(undefined, 'in-progress')).toBe(false);
  });
});
