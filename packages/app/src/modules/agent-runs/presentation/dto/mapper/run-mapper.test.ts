import { describe, expect, it } from 'vitest';
import type { Run } from '../../../business/domain/types/run.js';
import { toActiveRunDto, toActiveWaitDto, toRunDto } from './run-mapper.js';

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

describe('run mapper', () => {
  describe('toRunDto', () => {
    it('should carry every field of the run when the run has ended with a wait', () => {
      const run = buildRun({
        state: 'ended',
        waitingFor: { kind: 'checkpoint', request: 'Check', artifactId: 'page' },
        waitingSince: '2026-09-29T10:05:00.000Z',
        ending: { kind: 'parked', blockerNumber: 42 },
        endedAt: '2026-09-29T10:06:00.000Z',
      });

      expect(toRunDto(run)).toEqual(run);
    });
  });

  describe('toActiveRunDto', () => {
    it('should carry only the run when the run is active', () => {
      const run = buildRun();

      expect(toActiveRunDto({ run })).toEqual({ run });
    });
  });

  describe('toActiveWaitDto', () => {
    it('should carry the ticket, kind and start of the wait', () => {
      expect(toActiveWaitDto({ ticketNumber: 5, kind: 'round', since: 'x' })).toEqual({
        ticketNumber: 5,
        kind: 'round',
        since: 'x',
      });
    });
  });
});
