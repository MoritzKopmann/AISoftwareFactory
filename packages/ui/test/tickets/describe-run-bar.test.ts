import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeRunBar, settleStartState } from '../../src/tickets/describe-run-bar.js';

const available: TicketRunResponse = { availability: { kind: 'available' } };
const disabled: TicketRunResponse = {
  availability: { kind: 'disabled', reason: '#42 is running. One run at a time in this project.' },
};
const absent: TicketRunResponse = { availability: { kind: 'absent' } };
const live: TicketRunResponse = {
  availability: { kind: 'disabled', reason: '#56 is running.' },
  activeRun: { id: 'run-1', startedAt: '2026-09-30T10:00:00Z', steps: [] },
};
const lastRun: NonNullable<TicketRunResponse['lastRun']> = {
  id: 'run-1',
  startedAt: '2026-09-30T10:00:00Z',
  endedAt: '2026-09-30T10:05:00Z',
  ending: { kind: 'stopped' },
};
const ended: TicketRunResponse = { availability: { kind: 'available' }, lastRun };
const failedStart = {
  kind: 'failed',
  message: 'Another run started first; #42 is running.',
  status: 409,
} as const;

describe('describeRunBar', () => {
  it('should hide the bar when no answer has arrived yet', () => {
    expect(
      describeRunBar(
        undefined,
        { status: 'ready', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide the bar when the run is absent', () => {
    expect(
      describeRunBar(
        absent,
        { status: 'planned', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'hidden',
    });
  });

  it('should show a pressable Run button with the worktree hint when the run is available', () => {
    expect(
      describeRunBar(
        available,
        { status: 'ready', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'shown',
      button: 'run',
      pressable: true,
      hint: 'Runs implement-ticket on #56 in its own worktree.',
    });
  });

  it('should name spike in the hint when the ticket runs the spike skill', () => {
    expect(
      describeRunBar(available, { status: 'ready', stuck: false }, { kind: 'idle' }, 56, 'spike'),
    ).toEqual({
      kind: 'shown',
      button: 'run',
      pressable: true,
      hint: 'Runs spike on #56 in its own worktree.',
    });
  });

  it("should show an unpressable disabled button with the API's reason when the run is disabled", () => {
    expect(
      describeRunBar(
        disabled,
        { status: 'ready', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'shown',
      button: 'disabled',
      pressable: false,
      reason: '#42 is running. One run at a time in this project.',
    });
  });

  it('should show an unpressable starting button with an announcement when a start is pending', () => {
    expect(
      describeRunBar(
        available,
        { status: 'ready', stuck: false },
        { kind: 'starting' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'shown',
      button: 'starting',
      pressable: false,
      announcement: 'Starting the run',
    });
  });

  it('should hide the bar when the poll shows an active run', () => {
    expect(
      describeRunBar(
        live,
        { status: 'in-progress', stuck: false },
        { kind: 'starting' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'hidden',
    });
  });

  it('should show a pressable Run button with the hint when the ready ticket has an ended run', () => {
    expect(
      describeRunBar(
        ended,
        { status: 'ready', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'shown',
      button: 'run',
      pressable: true,
      hint: 'Runs implement-ticket on #56 in its own worktree.',
    });
  });

  it('should show the disabled reason when GitHub is catching up after an ended run', () => {
    const response: TicketRunResponse = {
      availability: { kind: 'disabled', reason: 'Waiting for GitHub to catch up' },
      lastRun,
    };
    expect(
      describeRunBar(
        response,
        { status: 'ready', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'shown',
      button: 'disabled',
      pressable: false,
      reason: 'Waiting for GitHub to catch up',
    });
  });

  it.each([
    {
      ticketState: { status: 'in-progress', stuck: true },
      ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: {} },
    },
    {
      ticketState: { status: 'in-progress', stuck: false },
      ending: { kind: 'checkpoint', request: 'Check the board.' },
    },
  ] as const)(
    'should hide the bar when the ticket is not ready and its run ended on $ending.kind',
    ({ ticketState, ending }) => {
      const response: TicketRunResponse = {
        availability: { kind: 'absent' },
        lastRun: { ...lastRun, ending },
      };
      expect(
        describeRunBar(response, ticketState, { kind: 'idle' }, 56, 'implement-ticket'),
      ).toEqual({
        kind: 'hidden',
      });
    },
  );

  it('should hide the bar when a run is active and an earlier run ended', () => {
    expect(
      describeRunBar(
        { ...live, lastRun },
        { status: 'in-progress', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'hidden',
    });
  });

  it.each([
    { name: 'no run', response: absent },
    { name: 'a stopped run', response: { ...absent, lastRun } },
  ])(
    'should show an unpressable disabled Run with the no-run reason when the ticket is in progress with $name and none is active',
    ({ response }) => {
      expect(
        describeRunBar(
          response,
          { status: 'in-progress', stuck: false },
          { kind: 'idle' },
          56,
          'implement-ticket',
        ),
      ).toEqual({
        kind: 'shown',
        button: 'disabled',
        pressable: false,
        reason: 'Ticket is in progress, but no run is active on it.',
      });
    },
  );

  it('should hide the bar when the in-progress ticket has not caught up with a checkpoint ending', () => {
    const response: TicketRunResponse = {
      ...absent,
      lastRun: { ...lastRun, ending: { kind: 'checkpoint', request: 'Check the board.' } },
    };
    expect(
      describeRunBar(
        response,
        { status: 'in-progress', stuck: false },
        { kind: 'idle' },
        56,
        'implement-ticket',
      ),
    ).toEqual({
      kind: 'hidden',
    });
  });

  it('should show a pressable Run button when the started run was seen active and has ended', () => {
    const afterActive = settleStartState({ kind: 'starting' }, live);
    expect(
      describeRunBar(ended, { status: 'ready', stuck: false }, afterActive, 56, 'implement-ticket'),
    ).toMatchObject({
      button: 'run',
      pressable: true,
    });
  });

  it('should keep the starting state when no active run has been seen yet', () => {
    expect(settleStartState({ kind: 'starting' }, ended)).toEqual({ kind: 'starting' });
  });

  it('should bring the Run button back without the hint and show the error with the status when the start failed', () => {
    expect(
      describeRunBar(
        available,
        { status: 'ready', stuck: false },
        failedStart,
        56,
        'implement-ticket',
      ),
    ).toEqual({
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
    expect(
      describeRunBar(
        disabled,
        { status: 'ready', stuck: false },
        failedStart,
        56,
        'implement-ticket',
      ),
    ).toMatchObject({
      button: 'disabled',
      reason: '#42 is running. One run at a time in this project.',
      error: { detail: '409' },
    });
  });

  it('should show the error without a detail line when the start failed without a status', () => {
    const description = describeRunBar(
      available,
      { status: 'ready', stuck: false },
      { kind: 'failed', message: "Can't reach aisf." },
      56,
      'implement-ticket',
    );
    expect(description).toMatchObject({
      error: { message: "Couldn't start the run. Can't reach aisf." },
    });
    expect(description).not.toHaveProperty('error.detail');
  });

  it('should end the error at the lead sentence when the server gave no message', () => {
    expect(
      describeRunBar(
        available,
        { status: 'ready', stuck: false },
        { kind: 'failed', message: '', status: 500 },
        56,
        'implement-ticket',
      ),
    ).toMatchObject({ error: { message: "Couldn't start the run.", detail: '500' } });
  });
});

describe('describeRunBar for idea and plan tickets', () => {
  it('should offer a pressable button naming the create skill when an idea ticket is available', () => {
    expect(
      describeRunBar(
        available,
        { status: 'idea', stuck: false },
        { kind: 'idle' },
        12,
        'create-ticket',
      ),
    ).toMatchObject({ kind: 'shown', button: 'run', pressable: true, label: 'Run create-ticket' });
  });

  it('should name the plan skill on the button when a plan ticket is available', () => {
    expect(
      describeRunBar(
        available,
        { status: 'plan', stuck: false },
        { kind: 'idle' },
        12,
        'plan-ticket',
      ),
    ).toMatchObject({ pressable: true, label: 'Run plan-ticket' });
  });

  it('should be disabled and show the reason when a plan ticket has an open spike', () => {
    expect(
      describeRunBar(
        { availability: { kind: 'disabled', reason: 'Spike #9 is open.' } },
        { status: 'plan', stuck: false },
        { kind: 'idle' },
        12,
        'plan-ticket',
      ),
    ).toMatchObject({ button: 'disabled', pressable: false, reason: 'Spike #9 is open.' });
  });
});
