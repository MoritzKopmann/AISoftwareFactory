import { describe, expect, it } from 'vitest';
import { endingForWaitingRun } from './ending-for-waiting-run.js';
import type { Run } from '../types/run.js';

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    projectId: 'moritz/aisf',
    ticketNumber: 137,
    stage: 'implement',
    mode: 'afk',
    sessionId: 'session-1',
    worktreePath: '/worktrees/aisf/137',
    branchName: 'aisf/137-runner',
    state: 'running',
    startedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

const waitingRun = buildRun({
  waitingFor: { kind: 'checkpoint', request: 'Check the page' },
  waitingSince: '2026-09-29T10:05:00.000Z',
});

describe('endingForWaitingRun', () => {
  it('should keep the ending when the run is not waiting', () => {
    expect(endingForWaitingRun(buildRun(), { kind: 'crashed', reason: 'boom' })).toEqual({
      kind: 'crashed',
      reason: 'boom',
    });
  });

  it('should keep the stopped ending when the run is waiting', () => {
    expect(endingForWaitingRun(waitingRun, { kind: 'stopped' })).toEqual({ kind: 'stopped' });
  });

  it.each([
    ['crashed', { kind: 'crashed', reason: 'x' }],
    ['app-restarted', { kind: 'app-restarted' }],
    ['finished', { kind: 'finished' }],
  ] as const)('should return the stored checkpoint wait when the ending is %s', (_kind, ending) => {
    expect(endingForWaitingRun(waitingRun, ending)).toEqual({
      kind: 'checkpoint',
      request: 'Check the page',
    });
  });

  it('should keep the artifactId when the checkpoint wait has one', () => {
    const run = buildRun({
      waitingFor: { kind: 'checkpoint', request: 'Pick one', artifactId: 'page-1' },
    });

    expect(endingForWaitingRun(run, { kind: 'crashed', reason: 'x' })).toEqual({
      kind: 'checkpoint',
      request: 'Pick one',
      artifactId: 'page-1',
    });
  });

  it('should keep the reason when an expired permission wait has one', () => {
    const wait = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
      reason: 'Posting to GitHub is hard-denied',
    } as const;

    expect(
      endingForWaitingRun(buildRun({ waitingFor: wait }), { kind: 'crashed', reason: 'x' }),
    ).toEqual(wait);
  });

  it('should return the permission wait as the ending when the run waits for a permission', () => {
    const wait = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    } as const;

    expect(endingForWaitingRun(buildRun({ waitingFor: wait }), { kind: 'app-restarted' })).toEqual(
      wait,
    );
  });
});
