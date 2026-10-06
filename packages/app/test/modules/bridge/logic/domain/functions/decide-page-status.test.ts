import { describe, expect, it } from 'vitest';
import { decidePageStatus } from '../../../../../../src/modules/bridge/logic/domain/functions/decide-page-status.js';
import { buildArtifact } from '../../../fakes/build-artifact.js';

const artifact = buildArtifact({ artifactId: 'plan', runId: 'r1' });

describe('decidePageStatus', () => {
  it('should be open when the publishing run is the latest and waits on this artifact', () => {
    expect(
      decidePageStatus(artifact, {
        id: 'r1',
        state: 'running',
        waitingFor: { artifactId: 'plan' },
      }),
    ).toBe('open');
  });

  it.each(['ended', 'settled'] as const)(
    'should be open when the publishing run is %s with a checkpoint ending on this artifact',
    (state) => {
      expect(
        decidePageStatus(artifact, {
          id: 'r1',
          state,
          ending: { kind: 'checkpoint', artifactId: 'plan' },
        }),
      ).toBe('open');
    },
  );

  it('should be closed when the publishing run waits on a plain checkpoint', () => {
    expect(decidePageStatus(artifact, { id: 'r1', state: 'running', waitingFor: {} })).toBe(
      'closed',
    );
  });

  it('should be closed when the publishing run waits on another artifact', () => {
    expect(
      decidePageStatus(artifact, {
        id: 'r1',
        state: 'running',
        waitingFor: { artifactId: 'notes' },
      }),
    ).toBe('closed');
  });

  it('should be closed when the checkpoint ending has no artifact', () => {
    expect(
      decidePageStatus(artifact, { id: 'r1', state: 'ended', ending: { kind: 'checkpoint' } }),
    ).toBe('closed');
  });

  it.each([true, false])('should be busy when another run is running (waiting: %s)', (waiting) => {
    expect(
      decidePageStatus(artifact, {
        id: 'r2',
        state: 'running',
        ...(waiting ? { waitingFor: { artifactId: 'plan' } } : {}),
      }),
    ).toBe('busy');
  });

  it('should be closed when the publishing run works without waiting', () => {
    expect(decidePageStatus(artifact, { id: 'r1', state: 'running' })).toBe('closed');
  });

  it('should be closed when the latest run ended with any other ending', () => {
    expect(
      decidePageStatus(artifact, { id: 'r1', state: 'ended', ending: { kind: 'finished' } }),
    ).toBe('closed');
    expect(
      decidePageStatus(artifact, { id: 'r2', state: 'ended', ending: { kind: 'finished' } }),
    ).toBe('closed');
  });

  it('should be closed when the ticket has no run', () => {
    expect(decidePageStatus(artifact, undefined)).toBe('closed');
  });
});
