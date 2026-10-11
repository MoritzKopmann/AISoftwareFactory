import type { NeedsYouResponse } from '@aisf/app/api-schemas/needs-you-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describeNeedsYou,
  foldNeedsYouOutcome,
  initialNeedsYouState,
} from '../../src/board/describe-needs-you.js';

const response: NeedsYouResponse = {
  rows: [
    {
      ticketNumber: 7,
      title: 'Export trips',
      action: 'answer-round',
      since: '2026-10-10T10:00:00Z',
    },
    { ticketNumber: 9, title: 'Fix map', action: 'decide-stuck', since: '2026-10-10T11:00:00Z' },
  ],
};

describe('describeNeedsYou', () => {
  it('should list each row with number, title, action text and ticket link when rows exist', () => {
    const state = foldNeedsYouOutcome(initialNeedsYouState, { kind: 'answer', response });
    const description = describeNeedsYou(state, 'o/n');
    expect(description.kind).toBe('list');
    if (description.kind !== 'list') return;
    expect(description.entries).toHaveLength(2);
    expect(description.entries[0]).toMatchObject({
      numberLabel: '#7',
      title: 'Export trips',
      href: '#/projects/o/n/tickets/7',
    });
    expect(description.entries[0]?.actionText).not.toBe('');
    expect(description.entries[1]?.href).toBe('#/projects/o/n/tickets/9');
  });

  it('should say nothing is waiting when there are no rows', () => {
    const state = foldNeedsYouOutcome(initialNeedsYouState, {
      kind: 'answer',
      response: { rows: [] },
    });
    expect(describeNeedsYou(state, 'o/n')).toEqual({
      kind: 'empty',
      message: 'Nothing is waiting for you',
    });
  });

  it('should show an error with retry when the request failed', () => {
    const state = foldNeedsYouOutcome(initialNeedsYouState, { kind: 'request-failed' });
    expect(describeNeedsYou(state, 'o/n')).toMatchObject({ kind: 'failed' });
  });

  it('should be loading when nothing has been read yet', () => {
    expect(describeNeedsYou(initialNeedsYouState, 'o/n')).toEqual({ kind: 'loading' });
  });

  it('should clear the failure when a later read answers', () => {
    const failed = foldNeedsYouOutcome(initialNeedsYouState, { kind: 'request-failed' });
    const state = foldNeedsYouOutcome(failed, { kind: 'answer', response });
    expect(describeNeedsYou(state, 'o/n').kind).toBe('list');
  });
});
