import { describe, expect, it } from 'vitest';
import { decideRunEndTransition, needsSpikeCheck } from './decide-run-end-transition.js';
import type { RunStage } from '../types/run-stage.js';
import type { RunEnding } from '../types/run-ending.js';
import type { TicketLiveState } from '../types/ticket-live-state.js';
import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

function live(status: TicketStatus, flags: Partial<TicketLiveState> = {}): TicketLiveState {
  return { status, waiting: false, stuck: false, ...flags };
}

describe('decideRunEndTransition', () => {
  it('should write nothing when an onboard run finished and the ticket is in-review', () => {
    const ending: RunEnding = { kind: 'finished' };

    expect(decideRunEndTransition(ending, live('in-review'), 'onboard')).toEqual({ kind: 'none' });
  });

  it.each<TicketStatus>(['ready', 'in-progress'])(
    'should mark the ticket stuck with the reason when the run escalated while it is %s',
    (status) => {
      const ending: RunEnding = {
        kind: 'escalated',
        escalation: 'red',
        reason: 'tests still fail',
      };

      expect(decideRunEndTransition(ending, live(status), 'implement')).toEqual({
        kind: 'flag',
        state: 'stuck',
        comment: 'The run escalated (red): tests still fail',
      });
    },
  );

  it.each<TicketStatus>(['ready', 'in-progress'])(
    'should mark the ticket waiting naming the tool call when a permission is needed while it is %s',
    (status) => {
      const ending: RunEnding = {
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'date' },
      };

      expect(decideRunEndTransition(ending, live(status), 'implement')).toEqual({
        kind: 'flag',
        state: 'waiting',
        comment: 'The run needs permission for Bash with input {"command":"date"}',
      });
    },
  );

  it('should append the reason to the comment when the permission ending has one', () => {
    const ending: RunEnding = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
      reason: 'Needs network',
    };

    expect(decideRunEndTransition(ending, live('in-progress'), 'implement')).toEqual({
      kind: 'flag',
      state: 'waiting',
      comment:
        'The run needs permission for Bash with input {"command":"ls"}\n\nReason: Needs network',
    });
  });

  it('should write nothing when a permission is needed while the ticket is already waiting', () => {
    const ending: RunEnding = { kind: 'permission-needed', toolName: 'Bash', toolInput: {} };

    expect(
      decideRunEndTransition(ending, live('in-progress', { waiting: true }), 'implement'),
    ).toEqual({
      kind: 'none',
    });
  });

  it('should write nothing when a permission is needed while the ticket is stuck', () => {
    const ending: RunEnding = { kind: 'permission-needed', toolName: 'Bash', toolInput: {} };

    expect(
      decideRunEndTransition(ending, live('in-progress', { stuck: true }), 'implement'),
    ).toEqual({
      kind: 'none',
    });
  });

  it('should return the ticket to ready without a comment when the run parked while it is in-progress', () => {
    const ending: RunEnding = { kind: 'parked', blockerNumber: 12 };

    expect(decideRunEndTransition(ending, live('in-progress'), 'implement')).toEqual({
      kind: 'return-to-ready',
    });
  });

  it.each<[RunEnding, string]>([
    [{ kind: 'finished' }, 'The run finished without completing the ticket'],
    [{ kind: 'stopped' }, 'The run was stopped'],
    [{ kind: 'crashed', reason: 'boom' }, 'The run crashed: boom'],
    [{ kind: 'app-restarted' }, 'The app restarted during the run'],
  ])(
    'should mark the ticket stuck with an exit reason when the run ended unplanned (%o)',
    (ending, comment) => {
      expect(decideRunEndTransition(ending, live('in-progress'), 'implement')).toEqual({
        kind: 'flag',
        state: 'stuck',
        comment,
      });
    },
  );

  it.each<[RunStage, TicketStatus]>([
    ['implement', 'in-progress'],
    ['implement', 'ready'],
    ['spike', 'in-progress'],
    ['plan', 'plan'],
    ['create', 'idea'],
  ])('should write nothing when a %s run hit the usage limit at %s', (stage, status) => {
    const ending: RunEnding = { kind: 'usage-limit', reason: 'limit hit' };

    expect(decideRunEndTransition(ending, live(status), stage)).toEqual({ kind: 'none' });
  });

  it.each<RunEnding>([
    { kind: 'finished' },
    { kind: 'usage-limit', reason: 'limit' },
    { kind: 'parked', blockerNumber: 3 },
  ])('should write nothing when the ticket is in-review (%o)', (ending) => {
    expect(decideRunEndTransition(ending, live('in-review'), 'implement')).toEqual({
      kind: 'none',
    });
  });

  it.each<TicketStatus>(['closed', 'idea', 'conflict'])(
    'should write nothing when the ticket is %s',
    (status) => {
      expect(decideRunEndTransition({ kind: 'finished' }, live(status), 'implement')).toEqual({
        kind: 'none',
      });
    },
  );

  it('should write nothing when the ticket is already stuck', () => {
    expect(
      decideRunEndTransition(
        { kind: 'finished' },
        live('in-progress', { stuck: true }),
        'implement',
      ),
    ).toEqual({ kind: 'none' });
  });

  it('should write nothing when a parked run finds the ticket ready', () => {
    expect(
      decideRunEndTransition({ kind: 'parked', blockerNumber: 3 }, live('ready'), 'implement'),
    ).toEqual({
      kind: 'none',
    });
  });

  describe('checkpoint', () => {
    const request = 'Open http://localhost:5173 and confirm the board shows a waiting marker';
    const ending: RunEnding = { kind: 'checkpoint', request };

    it.each<TicketStatus>(['ready', 'in-progress'])(
      'should mark the ticket waiting with the request comment when the run reached its checkpoint while it is %s',
      (status) => {
        expect(decideRunEndTransition(ending, live(status), 'implement')).toEqual({
          kind: 'flag',
          state: 'waiting',
          comment: `The run reached its human checkpoint and waits for an answer on the ticket page:\n\n${request}`,
        });
      },
    );

    it.each<TicketStatus>(['conflict', 'closed'])(
      'should write nothing when the checkpoint run finds the ticket %s',
      (status) => {
        expect(decideRunEndTransition(ending, live(status), 'implement')).toEqual({ kind: 'none' });
      },
    );

    it('should write nothing when the checkpoint run finds the ticket already waiting', () => {
      expect(
        decideRunEndTransition(ending, live('in-progress', { waiting: true }), 'implement'),
      ).toEqual({
        kind: 'none',
      });
    });
  });

  describe('waiting ticket', () => {
    const waiting = live('in-progress', { waiting: true });

    it('should mark the ticket stuck when a waiting run was stopped', () => {
      expect(decideRunEndTransition({ kind: 'stopped' }, waiting, 'implement')).toEqual({
        kind: 'flag',
        state: 'stuck',
        comment: 'The run was stopped',
      });
    });

    it('should mark the ticket stuck when a waiting run crashed', () => {
      expect(
        decideRunEndTransition({ kind: 'crashed', reason: 'x' }, waiting, 'implement'),
      ).toEqual({
        kind: 'flag',
        state: 'stuck',
        comment: 'The run crashed: x',
      });
    });

    it('should return the ticket to ready when a waiting run parked', () => {
      expect(
        decideRunEndTransition({ kind: 'parked', blockerNumber: 3 }, waiting, 'implement'),
      ).toEqual({
        kind: 'return-to-ready',
      });
    });
  });
});

describe('decideRunEndTransition for a rework run', () => {
  const inReview = live('in-review');

  it('should write nothing when the rework finished', () => {
    expect(decideRunEndTransition({ kind: 'finished' }, inReview, 'implement')).toEqual({
      kind: 'none',
    });
  });

  it('should mark the ticket stuck when the rework crashed before its claim', () => {
    expect(
      decideRunEndTransition({ kind: 'crashed', reason: 'boom' }, inReview, 'implement'),
    ).toEqual({ kind: 'flag', state: 'stuck', comment: 'The run crashed: boom' });
  });

  it('should mark the ticket stuck with the escalation when the rework escalated', () => {
    expect(
      decideRunEndTransition(
        { kind: 'escalated', escalation: 'red', reason: 'tests fail' },
        inReview,
        'implement',
      ),
    ).toEqual({
      kind: 'flag',
      state: 'stuck',
      comment: 'The run escalated (red): tests fail',
    });
  });

  it('should mark the ticket waiting when the rework reached its checkpoint', () => {
    expect(
      decideRunEndTransition({ kind: 'checkpoint', request: 'Look' }, inReview, 'implement'),
    ).toMatchObject({ kind: 'flag', state: 'waiting' });
  });

  it('should write nothing when the rework checkpoint finds the ticket already waiting', () => {
    expect(
      decideRunEndTransition(
        { kind: 'checkpoint', request: 'Look' },
        live('in-review', { waiting: true }),
        'implement',
      ),
    ).toEqual({ kind: 'none' });
  });

  it('should write nothing when the rework crashed and the ticket is already stuck', () => {
    expect(
      decideRunEndTransition(
        { kind: 'crashed', reason: 'x' },
        live('in-review', { stuck: true }),
        'implement',
      ),
    ).toEqual({ kind: 'none' });
  });

  it('should mark the ticket stuck when a run finished while the ticket is in-progress', () => {
    expect(decideRunEndTransition({ kind: 'finished' }, live('in-progress'), 'implement')).toEqual({
      kind: 'flag',
      state: 'stuck',
      comment: 'The run finished without completing the ticket',
    });
  });

  it('should write nothing when a spike run crashed and the ticket is in-review', () => {
    expect(decideRunEndTransition({ kind: 'crashed', reason: 'x' }, inReview, 'spike')).toEqual({
      kind: 'none',
    });
  });
});

describe('decideRunEndTransition for authoring runs', () => {
  it.each<[Exclude<RunStage, 'implement' | 'spike'>, TicketStatus]>([
    ['create', 'idea'],
    ['plan', 'plan'],
  ])(
    'should mark the ticket waiting when a %s run reaches its checkpoint at %s',
    (stage, status) => {
      const ending: RunEnding = { kind: 'checkpoint', request: 'Answer on the page' };

      expect(decideRunEndTransition(ending, live(status), stage)).toEqual({
        kind: 'flag',
        state: 'waiting',
        comment: expect.stringContaining('Answer on the page') as string,
      });
    },
  );

  it.each<[Exclude<RunStage, 'implement' | 'spike'>, TicketStatus]>([
    ['create', 'idea'],
    ['plan', 'plan'],
  ])('should mark the ticket stuck when a %s run crashed at %s', (stage, status) => {
    expect(
      decideRunEndTransition({ kind: 'crashed', reason: 'boom' }, live(status), stage),
    ).toEqual({ kind: 'flag', state: 'stuck', comment: 'The run crashed: boom' });
  });

  it.each<[Exclude<RunStage, 'implement' | 'spike'>, TicketStatus]>([
    ['create', 'idea'],
    ['plan', 'plan'],
    ['create', 'backlog'],
    ['create', 'plan'],
    ['plan', 'idea'],
  ])('should write nothing when a %s run finished and the ticket is %s', (stage, status) => {
    expect(decideRunEndTransition({ kind: 'finished' }, live(status), stage)).toEqual({
      kind: 'none',
    });
  });

  it('should write nothing when an authoring run parked', () => {
    expect(
      decideRunEndTransition({ kind: 'parked', blockerNumber: 3 }, live('plan'), 'plan'),
    ).toEqual({ kind: 'none' });
  });

  it.each<[Exclude<RunStage, 'implement' | 'spike'>, TicketStatus]>([
    ['create', 'plan'],
    ['create', 'ready'],
    ['plan', 'idea'],
    ['plan', 'in-progress'],
  ])('should write nothing when a %s run crashed and the ticket is %s', (stage, status) => {
    expect(decideRunEndTransition({ kind: 'crashed', reason: 'x' }, live(status), stage)).toEqual({
      kind: 'none',
    });
  });

  it('should write nothing when an implement run ends on an idea ticket', () => {
    expect(
      decideRunEndTransition({ kind: 'crashed', reason: 'x' }, live('idea'), 'implement'),
    ).toEqual({
      kind: 'none',
    });
  });
});

describe('decideRunEndTransition for a plan run that finished', () => {
  const finished: RunEnding = { kind: 'finished' };

  it('should mark the ticket stuck when the ticket is still at plan with no open spike', () => {
    expect(decideRunEndTransition(finished, live('plan'), 'plan', false)).toEqual({
      kind: 'flag',
      state: 'stuck',
      comment: 'The plan run finished but the ticket is still at plan',
    });
  });

  it('should change nothing when the ticket is still at plan with an open spike', () => {
    expect(decideRunEndTransition(finished, live('plan'), 'plan', true)).toEqual({ kind: 'none' });
  });

  it('should change nothing when the ticket moved on to planned', () => {
    expect(decideRunEndTransition(finished, live('planned'), 'plan', false)).toEqual({
      kind: 'none',
    });
  });

  it('should change nothing when the ticket is already stuck', () => {
    expect(decideRunEndTransition(finished, live('plan', { stuck: true }), 'plan', false)).toEqual({
      kind: 'none',
    });
  });

  it('should change nothing when a create run finished at idea', () => {
    expect(decideRunEndTransition(finished, live('idea'), 'create', false)).toEqual({
      kind: 'none',
    });
  });
});

describe('decideRunEndTransition for design runs', () => {
  it('should mark the idea waiting when a design run reaches its checkpoint', () => {
    const ending: RunEnding = { kind: 'checkpoint', request: 'Accept the design' };

    expect(decideRunEndTransition(ending, live('idea'), 'design')).toEqual({
      kind: 'flag',
      state: 'waiting',
      comment: expect.stringContaining('Accept the design') as string,
    });
  });

  it('should write nothing when a design run finished and the ticket is at plan', () => {
    expect(decideRunEndTransition({ kind: 'finished' }, live('plan'), 'design')).toEqual({
      kind: 'none',
    });
  });

  it('should write nothing when a design run parked on an idea', () => {
    expect(
      decideRunEndTransition({ kind: 'parked', blockerNumber: 3 }, live('idea'), 'design'),
    ).toEqual({ kind: 'none' });
  });
});

describe('needsSpikeCheck', () => {
  it('should be true only when a plan run finished with the ticket at plan and not stuck', () => {
    expect(needsSpikeCheck({ kind: 'finished' }, live('plan'), 'plan')).toBe(true);
    expect(needsSpikeCheck({ kind: 'finished' }, live('planned'), 'plan')).toBe(false);
    expect(needsSpikeCheck({ kind: 'finished' }, live('plan', { stuck: true }), 'plan')).toBe(
      false,
    );
    expect(needsSpikeCheck({ kind: 'finished' }, live('idea'), 'create')).toBe(false);
    expect(needsSpikeCheck({ kind: 'crashed', reason: 'x' }, live('plan'), 'plan')).toBe(false);
  });
});
