import type { RunEndingResponse, TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeCheckpointPrompt } from './describe-checkpoint-prompt.js';
import { describeRoundPanel, type RoundPanelContext } from './describe-round-panel.js';

const withPage: TicketRunResponse = {
  availability: { kind: 'disabled', reason: 'r' },
  activeRun: {
    id: 'run-1',
    startedAt: '2026-10-10T10:00:00Z',
    steps: [],
    waitingFor: {
      kind: 'checkpoint',
      request: 'Pick',
      page: { title: 'Plan round 2', url: '/pages/a/index.html' },
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

function localTime(hours: number, minutes: number): string {
  return new Date(2026, 9, 10, hours, minutes).toISOString();
}

function endedWith(ending: RunEndingResponse, runId = 'run-1'): TicketRunResponse {
  return {
    availability: { kind: 'available' },
    lastRun: { id: runId, startedAt: localTime(14, 4), endedAt: localTime(14, 22), ending },
  };
}

function context(overrides: Partial<RoundPanelContext> = {}): RoundPanelContext {
  return {
    ticketStatus: 'plan',
    ticketNumber: 412,
    roundRunId: undefined,
    stopping: false,
    ...overrides,
  };
}

describe('describeRoundPanel', () => {
  it('should show the page, the status and number subtitle and a pressable Stop when the wait carries a page', () => {
    expect(describeRoundPanel(withPage, context())).toEqual({
      kind: 'shown',
      title: 'Plan round 2',
      url: '/pages/a/index.html',
      subtitle: 'Plan #412 · Plan round 2',
      stop: { label: 'Stop', pressable: true },
    });
  });

  it('should turn Stop into an announced, unpressable Stopping… when Stop was pressed', () => {
    const description = describeRoundPanel(withPage, context({ stopping: true }));
    expect(description.kind === 'shown' && description.stop).toEqual({
      label: 'Stopping…',
      pressable: false,
      announcement: 'Stopping the run',
    });
  });

  it('should show the run ended state when the remembered run ended before its round was answered', () => {
    expect(
      describeRoundPanel(endedWith({ kind: 'stopped' }), context({ roundRunId: 'run-1' })),
    ).toEqual({
      kind: 'ended',
      endedLabel: 'Ended 14:22 · 18 min',
      note: 'The run ended before this round was answered.',
    });
  });

  it('should be hidden when the remembered run ended at its checkpoint', () => {
    const atCheckpoint = endedWith({ kind: 'checkpoint', request: 'Pick' });
    expect(describeRoundPanel(atCheckpoint, context({ roundRunId: 'run-1' }))).toEqual({
      kind: 'hidden',
    });
  });

  it('should be hidden when the ended run is not the remembered one', () => {
    expect(describeRoundPanel(endedWith({ kind: 'stopped' }), context())).toEqual({
      kind: 'hidden',
    });
  });

  it('should be hidden when the wait has no page', () => {
    expect(describeRoundPanel(withoutPage, context())).toEqual({ kind: 'hidden' });
  });

  it('should be hidden when no answer has arrived', () => {
    expect(describeRoundPanel(undefined, context())).toEqual({ kind: 'hidden' });
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
