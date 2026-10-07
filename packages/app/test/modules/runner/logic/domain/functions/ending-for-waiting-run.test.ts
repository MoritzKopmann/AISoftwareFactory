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
