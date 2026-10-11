import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeCheckpointPrompt } from '../../src/tickets/describe-checkpoint-prompt.js';
import { describeRoundPanel } from '../../src/tickets/describe-round-panel.js';

const withPage: TicketRunResponse = {
  availability: { kind: 'disabled', reason: 'r' },
  activeRun: {
    id: 'run-1',
    startedAt: '2026-10-10T10:00:00Z',
    steps: [],
    waitingFor: {
      kind: 'checkpoint',
      request: 'Pick',
      page: { title: 'Round 1', url: '/pages/a/index.html' },
    },
  },
};
const withoutPage: TicketRunResponse = {
  ...withPage,
  activeRun: {
    id: 'run-1',
    startedAt: '2026-10-10T10:00:00Z',
    steps: [],
    waitingFor: { kind: 'checkpoint', request: 'Pick' },
  },
};

describe('describeRoundPanel', () => {
  it('should show the page title and url when the wait carries a page', () => {
    expect(describeRoundPanel(withPage)).toEqual({
      kind: 'shown',
      title: 'Round 1',
      url: '/pages/a/index.html',
    });
  });

  it('should be hidden when the wait has no page', () => {
    expect(describeRoundPanel(withoutPage)).toEqual({ kind: 'hidden' });
  });

  it('should be hidden when no answer has arrived', () => {
    expect(describeRoundPanel(undefined)).toEqual({ kind: 'hidden' });
  });
});

describe('describeCheckpointPrompt with a page', () => {
  it('should hide the question prompt when the wait carries a page', () => {
    expect(describeCheckpointPrompt(withPage, true, undefined)).toEqual({ kind: 'hidden' });
  });

  it('should show the question prompt when the wait has no page', () => {
    expect(describeCheckpointPrompt(withoutPage, true, undefined).kind).toBe('shown');
  });
});
