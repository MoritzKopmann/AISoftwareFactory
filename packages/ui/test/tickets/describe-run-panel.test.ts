import type {
  RunEndingResponse,
  RunStepResponse,
  TicketRunResponse,
} from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeRunPanel, type RunPanelInput } from '../../src/tickets/describe-run-panel.js';

function localTime(hours: number, minutes: number, seconds = 0): string {
  return new Date(2026, 8, 30, hours, minutes, seconds).toISOString();
}

const now = new Date(localTime(9, 45));

const idle: TicketRunResponse = { availability: { kind: 'available' } };

function live(startedAt: string, steps: RunStepResponse[]): TicketRunResponse {
  return { ...idle, activeRun: { id: 'run-1', startedAt, steps } };
}

function input(overrides: Partial<RunPanelInput>): RunPanelInput {
  return {
    response: idle,
    answeredAt: localTime(9, 44, 58),
    lastPollFailed: false,
    ticketStatus: 'in-progress',
    stopping: false,
    ...overrides,
  };
}

describe('describeRunPanel', () => {
  it('should hide the panel when no answer has arrived yet', () => {
    const unanswered: RunPanelInput = {
      lastPollFailed: false,
      ticketStatus: 'in-progress',
      stopping: false,
    };
    expect(describeRunPanel(unanswered, now)).toEqual({ kind: 'hidden' });
  });

  it('should hide the panel when the ticket has no active run and is not stuck', () => {
    expect(describeRunPanel(input({ ticketStatus: 'ready' }), now)).toEqual({ kind: 'hidden' });
  });

  it('should show a live panel with Stop and the starting line when the active run has no steps', () => {
    const starting = live(localTime(9, 44, 30), []);

    expect(describeRunPanel(input({ response: starting }), now)).toEqual({
      kind: 'live',
      waiting: false,
      startedLabel: 'Started just now',
      stop: { label: 'Stop', pressable: true },
      steps: [],
      emptyMessage: 'Starting the session. Steps show up here as they happen.',
    });
  });

  it('should keep the last 5 steps oldest first with clock times and mark the newest when there are more', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7].map((second) => ({
      at: localTime(9, 41, second),
      summary: `Step ${second}`,
    }));

    const description = describeRunPanel(input({ response: live(localTime(9, 26), steps) }), now);

    expect(description).toMatchObject({
      kind: 'live',
      startedLabel: 'Started 19 min ago',
      steps: [3, 4, 5, 6, 7].map((second) => ({
        at: localTime(9, 41, second),
        time: `09:41:0${second}`,
        summary: `Step ${second}`,
        latest: second === 7,
      })),
    });
    expect(description).not.toHaveProperty('emptyMessage');
  });

  it('should show an unpressable Stopping… button with an announcement when Stop was pressed', () => {
    const description = describeRunPanel(
      input({ response: live(localTime(9, 39), []), stopping: true }),
      now,
    );

    expect(description).toMatchObject({
      kind: 'live',
      stop: { label: 'Stopping…', pressable: false, announcement: 'Stopping the run' },
    });
  });

  it('should keep the steps and Stop and add the banner with the last answer time when the poll failed', () => {
    const steps = [{ at: localTime(9, 41, 52), summary: 'Bash: npm test' }];

    const description = describeRunPanel(
      input({
        response: live(localTime(9, 41), steps),
        answeredAt: localTime(9, 41, 58),
        lastPollFailed: true,
      }),
      now,
    );

    expect(description).toMatchObject({
      kind: 'live',
      stop: { label: 'Stop', pressable: true },
      steps: [{ summary: 'Bash: npm test' }],
      banner:
        "Can't reach aisf. Showing the steps from 09:41; retrying when something changes, or on Retry.",
    });
  });

  it('should show no banner when the last poll answered', () => {
    expect(
      describeRunPanel(input({ response: live(localTime(9, 41), []) }), now),
    ).not.toHaveProperty('banner');
  });

  it('should show the ended block with the end time, run length and reason when the stuck ticket ended on Stop', () => {
    const description = describeRunPanel(
      input({ response: ended({ kind: 'stopped' }), ticketStatus: 'stuck' }),
      now,
    );

    expect(description).toEqual({
      kind: 'ended',
      endedLabel: 'Ended 09:47 · ran 6 min',
      note: 'Run ended: you pressed Stop. The worktree and branch are left as they are.',
    });
  });

  it.each<[string, RunEndingResponse, string]>([
    [
      'crashed',
      { kind: 'crashed', reason: 'Exit code 1.' },
      'Run ended: the session crashed. Exit code 1.',
    ],
    [
      'usage-limit',
      { kind: 'usage-limit', reason: 'The 5-hour usage limit was reached' },
      'Run ended: the usage limit was reached.',
    ],
    ['app-restarted', { kind: 'app-restarted' }, 'Run ended: aisf restarted during the run.'],
    [
      'escalated',
      { kind: 'escalated', escalation: 'red', reason: 'Tests stay red after 5 attempts.' },
      'Run ended: Tests stay red after 5 attempts.',
    ],
    [
      'finished',
      { kind: 'finished' },
      'Run ended: the session finished without completing the ticket.',
    ],
    ['parked', { kind: 'parked', blockerNumber: 42 }, 'Run ended: parked until #42 is done.'],
  ])('should state the reason when the run ended as %s', (_kind, ending, note) => {
    expect(
      describeRunPanel(input({ response: ended(ending), ticketStatus: 'stuck' }), now),
    ).toMatchObject({ kind: 'ended', note });
  });

  it('should say the run took under a minute when it ended within its first minute', () => {
    const response = ended({ kind: 'stopped' }, localTime(9, 47), localTime(9, 47, 40));

    expect(describeRunPanel(input({ response, ticketStatus: 'stuck' }), now)).toMatchObject({
      endedLabel: 'Ended 09:47 · ran under 1 min',
    });
  });

  it('should hide the panel when the stuck ticket ended on a permission prompt', () => {
    const response = ended({ kind: 'permission-needed', toolName: 'Bash', toolInput: {} });

    expect(describeRunPanel(input({ response, ticketStatus: 'stuck' }), now)).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide the panel when the ticket has an ended run but is not stuck', () => {
    const response = ended({ kind: 'stopped' });

    expect(describeRunPanel(input({ response, ticketStatus: 'ready' }), now)).toEqual({
      kind: 'hidden',
    });
  });
});

describe('describeRunPanel checkpoint ending', () => {
  it.each(['stuck', 'waiting'] as const)(
    'should hide the panel when the run ended on a checkpoint and the ticket is %s',
    (ticketStatus) => {
      const response = ended({ kind: 'checkpoint', request: 'Open the board.' });
      expect(describeRunPanel(input({ response, ticketStatus }), now)).toEqual({ kind: 'hidden' });
    },
  );
});

function ended(
  ending: RunEndingResponse,
  startedAt = localTime(9, 41),
  endedAt = localTime(9, 47, 30),
): TicketRunResponse {
  return { ...idle, lastRun: { id: 'run-1', startedAt, endedAt, ending } };
}

describe('describeRunPanel for a waiting run', () => {
  const waitingResponse: TicketRunResponse = {
    ...idle,
    activeRun: {
      id: 'run-1',
      startedAt: localTime(9, 41),
      steps: [],
      waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
    },
  };

  it('should describe the live run as waiting with Stop pressable when the run waits', () => {
    expect(describeRunPanel(input({ response: waitingResponse }), now)).toMatchObject({
      kind: 'live',
      waiting: true,
      stop: { label: 'Stop', pressable: true },
    });
  });

  it('should describe the live run as not waiting when it works', () => {
    const working = live(localTime(9, 41), []);
    expect(describeRunPanel(input({ response: working }), now)).toMatchObject({ waiting: false });
  });
});
