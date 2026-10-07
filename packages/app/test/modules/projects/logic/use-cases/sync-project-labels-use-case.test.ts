import { describe, expect, it } from 'vitest';
import type { Project } from '../../../../../src/modules/projects/logic/domain/types/project.js';
import { LabelSyncFailedError } from '../../../../../src/modules/projects/logic/errors/label-sync-failed-error.js';
import { SyncProjectLabelsUseCase } from '../../../../../src/modules/projects/logic/use-cases/sync-project-labels-use-case.js';
import { createLogger, type LogLevel } from '../../../../../src/shared/logger/create-logger.js';
import { FakeLabelSync, FakeProjectRepository } from '../../fakes/fake-projects-ports.js';

function createProject(owner: string, name: string): Project {
  return {
    id: `${owner}/${name}`,
    repository: { owner, name },
    checkoutPath: `/home/user/${name}`,
    addedAt: '2026-09-27T00:00:00.000Z',
  };
}

async function createSubject(projects: ReadonlyArray<Project>) {
  const projectRepository = new FakeProjectRepository();
  for (const project of projects) {
    await projectRepository.save(project);
  }
  const labelSync = new FakeLabelSync();
  const logged: Array<[LogLevel, string]> = [];
  const logger = createLogger((level, message) => logged.push([level, message]));
  const useCase = new SyncProjectLabelsUseCase({ projectRepository, labelSync, logger });
  return { useCase, labelSync, logged };
}

describe('SyncProjectLabelsUseCase', () => {
  describe('execute', () => {
    it('should sync each repository in list order when two projects are registered', async () => {
      const firstProject = createProject('moritz', 'aisf');
      const secondProject = createProject('moritz', 'other');
      const { useCase, labelSync } = await createSubject([firstProject, secondProject]);

      await useCase.execute();

      expect(labelSync.syncCalls).toEqual([firstProject.repository, secondProject.repository]);
    });

    it('should sync nothing and log nothing when no project is registered', async () => {
      const { useCase, labelSync, logged } = await createSubject([]);

      await expect(useCase.execute()).resolves.toBeUndefined();

      expect(labelSync.syncCalls).toEqual([]);
      expect(logged).toEqual([]);
    });

    it('should sync the other projects and warn once when one project fails with a LabelSyncFailedError', async () => {
      const firstProject = createProject('moritz', 'aisf');
      const secondProject = createProject('moritz', 'gone');
      const thirdProject = createProject('moritz', 'other');
      const { useCase, labelSync, logged } = await createSubject([
        firstProject,
        secondProject,
        thirdProject,
      ]);
      labelSync.setFailure(
        secondProject.repository,
        new LabelSyncFailedError('repository not found'),
      );

      await expect(useCase.execute()).resolves.toBeUndefined();

      expect(labelSync.syncCalls).toEqual([
        firstProject.repository,
        secondProject.repository,
        thirdProject.repository,
      ]);
      expect(logged).toHaveLength(1);
      expect(logged[0]?.[0]).toBe('warn');
      expect(logged[0]?.[1]).toContain('moritz/gone');
      expect(logged[0]?.[1]).toContain('repository not found');
    });

    it('should reject with the error and not warn when the failure is not a LabelSyncFailedError', async () => {
      const project = createProject('moritz', 'aisf');
      const { useCase, labelSync, logged } = await createSubject([project]);
      const failure = new Error('database is locked');
      labelSync.setFailure(project.repository, failure);

      await expect(useCase.execute()).rejects.toBe(failure);

      expect(logged).toEqual([]);
    });
  });
});
