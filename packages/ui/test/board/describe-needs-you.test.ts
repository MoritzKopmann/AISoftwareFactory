import type { NeedsYouResponse } from '@aisf/app/api-schemas/needs-you-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describeNeedsYou,
  foldNeedsYouOutcome,
  initialNeedsYouState,
} from '../../src/board/describe-needs-you.js';

const now = new Date('2026-10-10T12:00:00Z');

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
    const description = describeNeedsYou(state, 'o/n', now);
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

  it('should count the rows when rows exist', () => {
    const state = foldNeedsYouOutcome(initialNeedsYouState, { kind: 'answer', response });
    expect(describeNeedsYou(state, 'o/n', now)).toMatchObject({ kind: 'list', count: 2 });
  });

  it('should give each action its text and tone when rows exist', () => {
    const actions = [
      'answer-round',
      'answer-question',
      'allow-permission',
      'decide-stuck',
      'review-pull-request',
    ] as const;
    const state = foldNeedsYouOutcome(initialNeedsYouState, {
      kind: 'answer',
      response: {
        rows: actions.map((action, index) => ({
          ticketNumber: index + 1,
          title: action,
          action,
          since: '2026-10-10T11:00:00Z',
        })),
      },
    });
    const description = describeNeedsYou(state, 'o/n', now);
    if (description.kind !== 'list') throw new Error('expected a list');
    expect(
      description.entries.map((entry) => ({
        actionText: entry.actionText,
        shape: entry.shape,
        tone: entry.tone,
      })),
    ).toEqual([
      { actionText: 'Answer a round', shape: '●', tone: 'hitl' },
      { actionText: 'Answer a question', shape: '●', tone: 'hitl' },
      { actionText: 'Allow or deny a permission', shape: '●', tone: 'hitl' },
      { actionText: 'Decide how the stuck ticket continues', shape: '■', tone: 'danger' },
      { actionText: 'Review the PR', shape: '●', tone: 'hitl' },
    ]);
  });

  it('should label the wait in whole hours, minutes or just now when rows exist', () => {
    const state = foldNeedsYouOutcome(initialNeedsYouState, {
      kind: 'answer',
      response: {
        rows: [
          { ticketNumber: 1, title: 'A', action: 'answer-round', since: '2026-10-10T09:50:00Z' },
          { ticketNumber: 2, title: 'B', action: 'answer-round', since: '2026-10-10T11:12:00Z' },
          { ticketNumber: 3, title: 'C', action: 'answer-round', since: '2026-10-10T11:59:30Z' },
        ],
      },
    });
    const description = describeNeedsYou(state, 'o/n', now);
    if (description.kind !== 'list') throw new Error('expected a list');
    expect(description.entries.map((entry) => entry.waitLabel)).toEqual([
      '2 h',
      '48 min',
      'just now',
    ]);
  });

  it('should say nothing is waiting when there are no rows', () => {
    const state = foldNeedsYouOutcome(initialNeedsYouState, {
      kind: 'answer',
      response: { rows: [] },
    });
    expect(describeNeedsYou(state, 'o/n', now)).toEqual({
      kind: 'empty',
      count: 0,
      message: 'Nothing is waiting for you',
    });
  });

  it('should say what failed and carry the failure detail when the request failed', () => {
    const state = foldNeedsYouOutcome(initialNeedsYouState, {
      kind: 'request-failed',
      detail: 'GET /needs-you · 502 Bad Gateway',
    });
    expect(describeNeedsYou(state, 'o/n', now)).toEqual({
      kind: 'failed',
      message: "Couldn't load what needs you.",
      detail: 'GET /needs-you · 502 Bad Gateway',
    });
  });

  it('should be loading when nothing has been read yet', () => {
    expect(describeNeedsYou(initialNeedsYouState, 'o/n', now)).toEqual({ kind: 'loading' });
  });

  it('should clear the failure when a later read answers', () => {
    const failed = foldNeedsYouOutcome(initialNeedsYouState, {
      kind: 'request-failed',
      detail: 'GET /needs-you · offline',
    });
    const state = foldNeedsYouOutcome(failed, { kind: 'answer', response });
    expect(describeNeedsYou(state, 'o/n', now).kind).toBe('list');
  });
});
