import { describe, expect, it } from 'vitest';
import { describeMoveToPlanAction } from './describe-move-to-plan-action.js';

describe('describeMoveToPlanAction', () => {
  it('should show an idle action when the ticket is in backlog and nothing was sent', () => {
    expect(describeMoveToPlanAction('backlog', { kind: 'idle' }, 57)).toEqual({ kind: 'idle' });
  });

  it('should describe sending when the request is in flight', () => {
    expect(describeMoveToPlanAction('backlog', { kind: 'sending' }, 57)).toEqual({
      kind: 'sending',
    });
  });

  it('should describe done when the server accepted the move and the ticket still shows backlog', () => {
    expect(describeMoveToPlanAction('backlog', { kind: 'done' }, 57)).toEqual({ kind: 'done' });
  });

  it("should describe failed with the server's message as-is when the move failed", () => {
    expect(
      describeMoveToPlanAction(
        'backlog',
        { kind: 'failed', message: 'Ticket #57 is no longer in backlog.', status: 409 },
        57,
      ),
    ).toEqual({ kind: 'failed', message: 'Ticket #57 is no longer in backlog.' });
  });

  it('should describe failed with a fallback message naming the ticket when the server sent none', () => {
    expect(
      describeMoveToPlanAction('backlog', { kind: 'failed', message: '', status: 400 }, 57),
    ).toEqual({ kind: 'failed', message: "Couldn't move #57 to plan." });
  });

  it('should keep the unreachable message when the request never reached the server', () => {
    expect(
      describeMoveToPlanAction('backlog', { kind: 'failed', message: "Can't reach aisf." }, 57),
    ).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });

  it.each(['idea', 'plan', 'planned', 'ready', 'in-progress', 'in-review'] as const)(
    'should be hidden when the ticket status is %s',
    (status) => {
      expect(describeMoveToPlanAction(status, { kind: 'done' }, 57)).toEqual({ kind: 'hidden' });
    },
  );
});
