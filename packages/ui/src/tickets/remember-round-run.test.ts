import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { rememberRoundRun } from './remember-round-run.js';

const withPage: TicketRunResponse = {
  availability: { kind: 'disabled', reason: 'r' },
  activeRun: {
    id: 'run-1',
    startedAt: '2026-10-10T10:00:00Z',
    waitingFor: {
      kind: 'checkpoint',
      request: 'Pick',
      page: { title: 'Plan round 2', url: '/pages/a/index.html' },
    },
  },
};

describe('rememberRoundRun', () => {
  it('should remember the run when it waits on a page', () => {
    expect(rememberRoundRun(undefined, withPage)).toBe('run-1');
  });

  it('should forget the run when a run is active without a page wait', () => {
    const answered: TicketRunResponse = {
      availability: { kind: 'disabled', reason: 'r' },
      activeRun: { id: 'run-1', startedAt: '2026-10-10T10:00:00Z' },
    };
    expect(rememberRoundRun('run-1', answered)).toBeUndefined();
  });

  it('should keep the run when no run is active', () => {
    expect(rememberRoundRun('run-1', { availability: { kind: 'available' } })).toBe('run-1');
  });
});
