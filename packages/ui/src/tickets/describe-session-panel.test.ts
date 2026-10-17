import { describe, expect, it } from 'vitest';
import type { RunPanelDescription } from './describe-run-panel.js';
import { describeSessionPanel } from './describe-session-panel.js';
import type { SessionView } from './fold-session-view.js';

const live: Extract<RunPanelDescription, { kind: 'live' }> = {
  kind: 'live',
  waiting: false,
  startedLabel: 'Started 4 min ago',
  stop: { label: 'Stop', pressable: true },
};
const hidden: RunPanelDescription = { kind: 'hidden' };
const entries: SessionView = { kind: 'entries', entries: [], ended: false };
const endedEntries: SessionView = { kind: 'entries', entries: [], ended: true };
const lastRun = {
  startedAt: new Date(2026, 9, 17, 14, 2).toISOString(),
  endedAt: new Date(2026, 9, 17, 14, 19).toISOString(),
};

describe('describeSessionPanel', () => {
  it('should describe the live head with an info rail and the Run label when a run is live', () => {
    expect(describeSessionPanel(live, entries, undefined)).toEqual({
      label: 'Run',
      rail: 'info',
      head: { kind: 'live', run: live },
    });
  });

  it('should keep the info rail when a run is live and the transcript is missing', () => {
    expect(describeSessionPanel(live, { kind: 'transcript-not-found' }, undefined).rail).toBe(
      'info',
    );
  });

  it('should show the start and end of the latest run when the stream sent ended', () => {
    expect(describeSessionPanel(hidden, endedEntries, lastRun)).toEqual({
      label: 'Session',
      rail: 'border-strong',
      head: { kind: 'session', timeRange: '14:02 – 14:19' },
    });
  });

  it('should show no time range when the stream sent ended and no run is known', () => {
    expect(describeSessionPanel(hidden, endedEntries, undefined).head).toEqual({
      kind: 'session',
    });
  });

  it('should show no time range when the stream has not sent ended', () => {
    expect(describeSessionPanel(hidden, entries, lastRun).head).toEqual({ kind: 'session' });
  });

  it('should describe a Session head with a border-strong rail when there is no session', () => {
    expect(describeSessionPanel(hidden, { kind: 'no-session' }, lastRun)).toEqual({
      label: 'Session',
      rail: 'border-strong',
      head: { kind: 'session' },
    });
  });

  it('should describe a Session head with a danger rail when the transcript is not found', () => {
    expect(describeSessionPanel(hidden, { kind: 'transcript-not-found' }, lastRun)).toEqual({
      label: 'Session',
      rail: 'danger',
      head: { kind: 'session' },
    });
  });

  it('should describe a Session head with a border-strong rail when the session is still loading', () => {
    expect(describeSessionPanel(hidden, { kind: 'waiting' }, undefined).rail).toBe('border-strong');
  });

  it('should describe a Session head when the run panel shows an ended run', () => {
    const ended: RunPanelDescription = { kind: 'ended', endedLabel: 'Ended 14:19', note: 'x' };
    expect(describeSessionPanel(ended, entries, lastRun).head.kind).toBe('session');
  });
});
