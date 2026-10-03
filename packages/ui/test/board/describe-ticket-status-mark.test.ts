import { describe, expect, it } from 'vitest';
import { describeTicketStatusMark } from '../../src/board/describe-ticket-status-mark.js';

describe('describeTicketStatusMark', () => {
  it('should return a neutral hollow circle when the status is idea or backlog', () => {
    for (const status of ['idea', 'backlog'] as const) {
      expect(describeTicketStatusMark(status)).toEqual({
        shape: '○',
        tone: 'neutral',
        pulses: false,
      });
    }
  });

  it('should return a still flow circle when the status is plan, planned, ready or in-review', () => {
    for (const status of ['plan', 'planned', 'ready', 'in-review'] as const) {
      expect(describeTicketStatusMark(status)).toEqual({
        shape: '●',
        tone: 'flow',
        pulses: false,
      });
    }
  });

  it('should return a pulsing flow circle when the status is in-progress', () => {
    expect(describeTicketStatusMark('in-progress')).toEqual({
      shape: '●',
      tone: 'flow',
      pulses: true,
    });
  });

  it('should return a still hitl circle when the status is waiting', () => {
    expect(describeTicketStatusMark('waiting')).toEqual({
      shape: '●',
      tone: 'hitl',
      pulses: false,
    });
  });

  it('should return a danger square when the status is stuck', () => {
    expect(describeTicketStatusMark('stuck')).toEqual({
      shape: '■',
      tone: 'danger',
      pulses: false,
    });
  });

  it('should return a warn triangle when the status is conflict', () => {
    expect(describeTicketStatusMark('conflict')).toEqual({
      shape: '▲',
      tone: 'warn',
      pulses: false,
    });
  });

  it('should return a done check when the status is closed', () => {
    expect(describeTicketStatusMark('closed')).toEqual({
      shape: '✓',
      tone: 'done',
      pulses: false,
    });
  });
});
