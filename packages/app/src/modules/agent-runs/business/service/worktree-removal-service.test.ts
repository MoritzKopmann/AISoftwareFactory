import { describe, expect, it, vi } from 'vitest';
import type { RunEnding } from '../domain/types/run-ending.js';
import { WorktreeRemovalFailedError } from '../errors/worktree-removal-failed-error.js';
import {
  buildRun,
  FakeProjectPort,
  FakeRunRepository,
  FakeWorktrees,
} from '../../testing/fake-agent-runs-ports.js';
import { WorktreeRemovalService } from './worktree-removal-service.js';

const target = { checkoutPath: '/checkouts/aisf', repositoryName: 'aisf' };
const worktreePath = '/worktrees/aisf/7';
const authoringPath = '/worktrees/aisf/7-authoring';

function buildSubject(options: { readonly projectKnown?: boolean } = {}) {
  const projectTarget = options.projectKnown === false ? undefined : target;
  const runRepository = new FakeRunRepository();
  const worktrees = new FakeWorktrees();
  const calls: string[] = [];
  const finishCalls: Array<{ runId: string; ending: RunEnding }> = [];
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const originalRemove = worktrees.remove.bind(worktrees);
  worktrees.remove = async (spec) => {
    calls.push(`remove ${spec.worktreePath}`);
    await originalRemove(spec);
  };
  const service = new WorktreeRemovalService({
    runRepository,
    worktrees,
    projectPort: new FakeProjectPort(projectTarget),
    runEndService: {
      finish: async (runId, ending) => {
        calls.push(`finish ${runId}`);
        finishCalls.push({ runId, ending });
      },
    },
    logger,
    worktreesDirectory: '/worktrees',
  });
  return { service, runRepository, worktrees, calls, finishCalls, logger };
}

describe('WorktreeRemovalService', () => {
  describe('removeForClosedTicket', () => {
    it('should remove both worktrees when the ticket has no active run', async () => {
      const { service, worktrees } = buildSubject();

      await service.removeForClosedTicket('moritz/aisf', 7);

      expect(worktrees.removedSpecs).toEqual([
        { checkoutPath: target.checkoutPath, worktreePath },
        { checkoutPath: target.checkoutPath, worktreePath: authoringPath },
      ]);
    });

    it('should end the active run as stopped before any removal when the ticket has a running run', async () => {
      const { service, runRepository, calls, finishCalls } = buildSubject();
      await runRepository.insert(buildRun({ id: 'run-7', ticketNumber: 7 }));
      await runRepository.insert(buildRun({ id: 'run-8', ticketNumber: 8 }));

      await service.removeForClosedTicket('moritz/aisf', 7);

      expect(finishCalls).toEqual([{ runId: 'run-7', ending: { kind: 'stopped' } }]);
      expect(calls).toEqual(['finish run-7', `remove ${worktreePath}`, `remove ${authoringPath}`]);
    });

    it('should not throw and still remove both paths when the run ended on its own meanwhile', async () => {
      const { service, runRepository, worktrees } = buildSubject();
      await runRepository.insert(buildRun({ id: 'run-7', ticketNumber: 7 }));
      await runRepository.recordEnding('run-7', { kind: 'finished' }, '2026-09-29T11:00:00.000Z');

      await expect(service.removeForClosedTicket('moritz/aisf', 7)).resolves.toBeUndefined();

      expect(worktrees.removedSpecs).toHaveLength(2);
    });

    it('should remove the other path and log the failure when one path fails', async () => {
      const { service, worktrees, logger } = buildSubject();
      worktrees.removalFailuresByPath.set(worktreePath, new WorktreeRemovalFailedError('locked'));

      await service.removeForClosedTicket('moritz/aisf', 7);

      expect(worktrees.removedSpecs.map((spec) => spec.worktreePath)).toEqual([authoringPath]);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('locked'));
    });

    it('should do nothing when the project is unknown', async () => {
      const { service, runRepository, worktrees, finishCalls } = buildSubject({
        projectKnown: false,
      });
      await runRepository.insert(buildRun({ id: 'run-7', ticketNumber: 7 }));

      await service.removeForClosedTicket('moritz/aisf', 7);

      expect(finishCalls).toEqual([]);
      expect(worktrees.removedSpecs).toEqual([]);
    });
  });
});
