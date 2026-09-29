import { describe, expect, it } from 'vitest';
import { decideRunEndTransition } from '../../../../../../src/modules/scheduler/logic/domain/functions/decide-run-end-transition.js';
import type { RunEnding } from '../../../../../../src/modules/scheduler/logic/domain/types/run-ending.js';
import type { TicketStatus } from '../../../../../../src/shared/ticket-status/ticket-status.js';

describe('decideRunEndTransition', () => {
  it.each<TicketStatus>(['ready', 'in-progress'])(
    'should move the ticket to stuck with the reason when the run escalated while it is %s',
    (liveStatus) => {
      const ending: RunEnding = {
        kind: 'escalated',
        escalation: 'red',
        reason: 'tests still fail',
      };

      expect(decideRunEndTransition(ending, liveStatus)).toEqual({
        kind: 'transition',
        allowedFrom: ['ready', 'in-progress'],
        to: 'stuck',
        comment: 'The run escalated (red): tests still fail',
      });
    },
  );

  it.each<TicketStatus>(['ready', 'in-progress'])(
    'should move the ticket to stuck naming the tool call when a permission is needed while it is %s',
    (liveStatus) => {
      const ending: RunEnding = {
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'rm -rf build' },
      };

      const transition = decideRunEndTransition(ending, liveStatus);

      expect(transition).toMatchObject({ kind: 'transition', to: 'stuck' });
      const comment = transition.kind === 'transition' ? transition.comment : undefined;
      expect(comment).toContain('Bash');
      expect(comment).toContain('rm -rf build');
    },
  );

  it('should return the ticket to ready without a comment when the run parked while it is in-progress', () => {
    const ending: RunEnding = { kind: 'parked', blockerNumber: 12 };

    expect(decideRunEndTransition(ending, 'in-progress')).toEqual({
      kind: 'transition',
      allowedFrom: ['in-progress'],
      to: 'ready',
    });
  });

  it.each<[RunEnding, string]>([
    [{ kind: 'finished' }, 'The run finished without opening a pull request'],
    [{ kind: 'stopped' }, 'The run was stopped'],
    [{ kind: 'crashed', reason: 'boom' }, 'The run crashed: boom'],
    [{ kind: 'usage-limit', reason: 'limit hit' }, 'The run hit the usage limit: limit hit'],
    [{ kind: 'app-restarted' }, 'The app restarted during the run'],
  ])(
    'should move the ticket to stuck with an exit reason when the run ended unplanned (%o)',
    (ending, comment) => {
      expect(decideRunEndTransition(ending, 'in-progress')).toEqual({
        kind: 'transition',
        allowedFrom: ['ready', 'in-progress'],
        to: 'stuck',
        comment,
      });
    },
  );

  it.each<RunEnding>([
    { kind: 'finished' },
    { kind: 'stopped' },
    { kind: 'crashed', reason: 'boom' },
    { kind: 'usage-limit', reason: 'limit' },
    { kind: 'app-restarted' },
    { kind: 'escalated', escalation: 'spec', reason: 'why' },
    { kind: 'permission-needed', toolName: 'Bash', toolInput: {} },
    { kind: 'parked', blockerNumber: 3 },
  ])('should write nothing when the ticket is in-review (%o)', (ending) => {
    expect(decideRunEndTransition(ending, 'in-review')).toEqual({ kind: 'none' });
  });

  it.each<TicketStatus>(['stuck', 'closed', 'idea'])(
    'should write nothing when the ticket is already %s',
    (liveStatus) => {
      expect(decideRunEndTransition({ kind: 'finished' }, liveStatus)).toEqual({ kind: 'none' });
    },
  );

  it('should write nothing when a parked run finds the ticket ready', () => {
    expect(decideRunEndTransition({ kind: 'parked', blockerNumber: 3 }, 'ready')).toEqual({
      kind: 'none',
    });
  });
});
