import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeResetAction, settleResetState } from '../../src/tickets/describe-reset-action.js';

const noRun: TicketRunResponse = { availability: { kind: 'absent' } };
const live: TicketRunResponse = {
  availability: { kind: 'absent' },
  activeRun: { id: 'run-2', startedAt: '2026-10-04T10:00:00Z', steps: [] },
};
const lastRun: NonNullable<TicketRunResponse['lastRun']> = {
  id: 'run-1',
  startedAt: '2026-10-04T09:00:00Z',
  endedAt: '2026-10-04T09:05:00Z',
  ending: { kind: 'stopped' },
};

describe('describeResetAction', () => {
  it('should show a pressable Reset when the ticket is stuck and no run is active', () => {
    expect(describeResetAction(noRun, 'stuck', { kind: 'idle' }, 57)).toEqual({
      kind: 'shown',
      resetting: false,
    });
  });

  it.each([
    { name: 'no run', response: noRun },
    { name: 'a stopped run', response: { ...noRun, lastRun } },
  ])(
    'should show a pressable Reset when the ticket is in progress with $name and none is active',
    ({ response }) => {
      expect(describeResetAction(response, 'in-progress', { kind: 'idle' }, 57)).toEqual({
        kind: 'shown',
        resetting: false,
      });
    },
  );

  it('should show a pressable Reset when the stuck ticket last ended at a checkpoint', () => {
    const response: TicketRunResponse = {
      ...noRun,
      lastRun: { ...lastRun, ending: { kind: 'checkpoint', request: 'Check the board.' } },
    };
    expect(describeResetAction(response, 'stuck', { kind: 'idle' }, 57)).toEqual({
      kind: 'shown',
      resetting: false,
    });
  });

  it('should hide Reset when no answer has arrived yet', () => {
    expect(describeResetAction(undefined, 'stuck', { kind: 'idle' }, 57)).toEqual({
      kind: 'hidden',
    });
  });

  it.each(['stuck', 'in-progress'] as const)(
    'should hide Reset when a run is active on the %s ticket',
    (ticketStatus) => {
      expect(describeResetAction(live, ticketStatus, { kind: 'idle' }, 57)).toEqual({
        kind: 'hidden',
      });
    },
  );

  it.each([
    'idea',
    'backlog',
    'plan',
    'planned',
    'ready',
    'waiting',
    'in-review',
    'conflict',
    'closed',
  ] as const)('should hide Reset when the ticket is %s', (ticketStatus) => {
    expect(describeResetAction(noRun, ticketStatus, { kind: 'idle' }, 57)).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide Reset when the in-progress ticket has not caught up with a checkpoint ending', () => {
    const response: TicketRunResponse = {
      ...noRun,
      lastRun: { ...lastRun, ending: { kind: 'checkpoint', request: 'Check the board.' } },
    };
    expect(describeResetAction(response, 'in-progress', { kind: 'idle' }, 57)).toEqual({
      kind: 'hidden',
    });
  });

  it('should show a busy Reset with an announcement when a reset is pending', () => {
    expect(describeResetAction(noRun, 'stuck', { kind: 'resetting' }, 57)).toEqual({
      kind: 'shown',
      resetting: true,
      announcement: 'Resetting #57',
    });
  });

  it('should show a pressable Reset with the error and the status when the reset failed', () => {
    const failed = {
      kind: 'failed',
      message: 'A run is active on this ticket.',
      status: 409,
    } as const;
    expect(describeResetAction(noRun, 'stuck', failed, 57)).toEqual({
      kind: 'shown',
      resetting: false,
      error: { message: "Couldn't reset #57. A run is active on this ticket.", detail: '409' },
    });
  });

  it('should show the error without a detail line when the reset failed without a status', () => {
    const description = describeResetAction(
      noRun,
      'stuck',
      { kind: 'failed', message: "Can't reach aisf." },
      57,
    );
    expect(description).toEqual({
      kind: 'shown',
      resetting: false,
      error: { message: "Couldn't reset #57. Can't reach aisf." },
    });
  });

  it('should end the error at the lead sentence when the server gave no message', () => {
    expect(
      describeResetAction(noRun, 'stuck', { kind: 'failed', message: '', status: 500 }, 57),
    ).toMatchObject({ error: { message: "Couldn't reset #57.", detail: '500' } });
  });
});

describe('settleResetState', () => {
  it('should settle a pending reset when the ticket shows ready', () => {
    expect(settleResetState({ kind: 'resetting' }, noRun, 'ready')).toEqual({ kind: 'idle' });
  });

  it('should keep a pending reset while the ticket still shows stuck', () => {
    expect(settleResetState({ kind: 'resetting' }, noRun, 'stuck')).toEqual({
      kind: 'resetting',
    });
  });

  it('should drop a failed reset when a run becomes active', () => {
    const failed = { kind: 'failed', message: '#57 has an active run', status: 409 } as const;
    expect(settleResetState(failed, live, 'in-progress')).toEqual({ kind: 'idle' });
  });
});
