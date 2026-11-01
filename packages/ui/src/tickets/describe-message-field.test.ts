import { describe, expect, it } from 'vitest';
import { formatResetTime } from '../usage/format-reset-time.js';
import {
  describeMessageField,
  editMessageDraft,
  type MessageDraft,
} from './describe-message-field.js';

const now = new Date('2026-10-19T10:00:00Z');

function aDraft(overrides: Partial<MessageDraft> = {}): MessageDraft {
  return { runId: 'run-1', draft: 'hello', send: { kind: 'idle' }, ...overrides };
}

describe('describeMessageField', () => {
  it('should disable the field when there is no active run', () => {
    const description = describeMessageField(undefined, aDraft(), now);

    expect(description).toMatchObject({ noActiveRun: true, pressable: false });
  });

  it('should not be pressable when the draft is only whitespace', () => {
    const description = describeMessageField('run-1', aDraft({ draft: '   ' }), now);

    expect(description).toMatchObject({ noActiveRun: false, pressable: false });
  });

  it('should be pressable when the run is active and the draft has text', () => {
    const description = describeMessageField('run-1', aDraft(), now);

    expect(description).toMatchObject({ draft: 'hello', pressable: true, sending: false });
  });

  it('should be empty and not pressable when there is no draft yet', () => {
    const description = describeMessageField('run-1', undefined, now);

    expect(description).toMatchObject({ draft: '', pressable: false });
  });

  it('should ignore a draft that belongs to another run', () => {
    const description = describeMessageField('run-2', aDraft(), now);

    expect(description).toMatchObject({ draft: '', pressable: false });
  });

  it('should not be pressable while sending', () => {
    const description = describeMessageField('run-1', aDraft({ send: { kind: 'sending' } }), now);

    expect(description).toMatchObject({ sending: true, pressable: false });
  });

  it('should show the error with its status when the send failed', () => {
    const description = describeMessageField(
      'run-1',
      aDraft({ send: { kind: 'failed', message: 'The run has ended.', status: 409 } }),
      now,
    );

    expect(description).toMatchObject({
      draft: 'hello',
      pressable: true,
      error: { message: 'The run has ended.', status: '409' },
    });
  });

  it('should show the error without a status when the network failed', () => {
    const description = describeMessageField(
      'run-1',
      aDraft({ send: { kind: 'failed', message: "Can't reach aisf." } }),
      now,
    );

    expect(description.error).toEqual({ message: "Can't reach aisf." });
  });

  it('should show the held line with the resume time when the message is held', () => {
    const description = describeMessageField(
      'run-1',
      aDraft({ draft: '', send: { kind: 'held', pausedUntil: '2026-10-19T14:00:00Z' } }),
      now,
    );

    expect(description.held?.heldUntilLabel).toBe(formatResetTime('2026-10-19T14:00:00Z', now));
  });
});

describe('editMessageDraft', () => {
  it('should return an idle draft for the run when the text is edited', () => {
    expect(editMessageDraft('run-1', 'hi')).toEqual({
      runId: 'run-1',
      draft: 'hi',
      send: { kind: 'idle' },
    });
  });
});
