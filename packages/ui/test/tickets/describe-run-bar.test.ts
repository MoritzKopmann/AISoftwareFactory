import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeRunBar } from '../../src/tickets/describe-run-bar.js';

const available: TicketRunResponse = { availability: { kind: 'available' } };
const disabled: TicketRunResponse = {
  availability: { kind: 'disabled', reason: '#42 is running. One run at a time in this project.' },
};
const absent: TicketRunResponse = { availability: { kind: 'absent' } };
const live: TicketRunResponse = {
  availability: { kind: 'disabled', reason: '#56 is running.' },
  activeRun: { id: 'run-1', startedAt: '2026-09-30T10:00:00Z', steps: [] },
};
const ended: TicketRunResponse = {
  availability: { kind: 'available' },
  lastRun: {
    id: 'run-1',
    startedAt: '2026-09-30T10:00:00Z',
    endedAt: '2026-09-30T10:05:00Z',
    ending: { kind: 'stopped' },
  },
};
const failedStart = {
  kind: 'failed',
  message: 'Another run started first; #42 is running.',
  status: 409,
} as const;

describe('describeRunBar', () => {
  it('should hide the bar when no answer has arrived yet', () => {
    expect(describeRunBar(undefined, { kind: 'idle' }, 56)).toEqual({ kind: 'hidden' });
  });

  it('should hide the bar when the run is absent', () => {
    expect(describeRunBar(absent, { kind: 'idle' }, 56)).toEqual({ kind: 'hidden' });
  });

  it('should show a pressable Run button with the worktree hint when the run is available', () => {
    expect(describeRunBar(available, { kind: 'idle' }, 56)).toEqual({
      kind: 'shown',
      button: 'run',
      pressable: true,
      hint: 'Runs implement-ticket on #56 in its own worktree.',
    });
  });

  it("should show an unpressable disabled button with the API's reason when the run is disabled", () => {
    expect(describeRunBar(disabled, { kind: 'idle' }, 56)).toEqual({
      kind: 'shown',
      button: 'disabled',
      pressable: false,
      reason: '#42 is running. One run at a time in this project.',
    });
  });

  it('should show an unpressable starting button with an announcement when a start is pending', () => {
    expect(describeRunBar(available, { kind: 'starting' }, 56)).toEqual({
      kind: 'shown',
      button: 'starting',
      pressable: false,
      announcement: 'Starting the run',
    });
  });

  it('should hide the bar when the poll shows an active run', () => {
    expect(describeRunBar(live, { kind: 'starting' }, 56)).toEqual({ kind: 'hidden' });
  });

  it('should hide the bar when the ticket has an ended run', () => {
    expect(describeRunBar(ended, { kind: 'idle' }, 56)).toEqual({ kind: 'hidden' });
  });

  it('should bring the Run button back without the hint and show the error with the status when the start failed', () => {
    expect(describeRunBar(available, failedStart, 56)).toEqual({
      kind: 'shown',
      button: 'run',
      pressable: true,
      error: {
        message: "Couldn't start the run. Another run started first; #42 is running.",
        detail: '409',
      },
    });
  });

  it('should keep the error under the disabled button when the run became disabled after a failed start', () => {
    expect(describeRunBar(disabled, failedStart, 56)).toMatchObject({
      button: 'disabled',
      reason: '#42 is running. One run at a time in this project.',
      error: { detail: '409' },
    });
  });

  it('should show the error without a detail line when the start failed without a status', () => {
    const description = describeRunBar(
      available,
      { kind: 'failed', message: "Can't reach aisf." },
      56,
    );
    expect(description).toMatchObject({
      error: { message: "Couldn't start the run. Can't reach aisf." },
    });
    expect(description).not.toHaveProperty('error.detail');
  });

  it('should end the error at the lead sentence when the server gave no message', () => {
    expect(
      describeRunBar(available, { kind: 'failed', message: '', status: 500 }, 56),
    ).toMatchObject({ error: { message: "Couldn't start the run.", detail: '500' } });
  });
});
