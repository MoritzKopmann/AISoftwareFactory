import { describe, expect, it } from 'vitest';
import { endingForWaitingRun } from '../../../../../../src/modules/runner/logic/domain/functions/ending-for-waiting-run.js';
import { buildRun } from '../../../fakes/fake-runner-ports.js';

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
    ['crashed', { kind: 'crashed', reason: 'boom' }],
    ['app-restarted', { kind: 'app-restarted' }],
    ['finished', { kind: 'finished' }],
    ['checkpoint', { kind: 'checkpoint', request: 'Check the page' }],
  ] as const)(
    'should turn a %s ending into a checkpoint when the run is waiting',
    (_kind, ending) => {
      expect(endingForWaitingRun(waitingRun, ending)).toEqual({
        kind: 'checkpoint',
        request: 'Check the page',
      });
    },
  );

  it('should copy the artifactId into the checkpoint when the wait has one', () => {
    const run = buildRun({
      waitingFor: { kind: 'checkpoint', request: 'Check the page', artifactId: 'confirm-plan' },
    });

    expect(endingForWaitingRun(run, { kind: 'app-restarted' })).toEqual({
      kind: 'checkpoint',
      request: 'Check the page',
      artifactId: 'confirm-plan',
    });
  });
});
