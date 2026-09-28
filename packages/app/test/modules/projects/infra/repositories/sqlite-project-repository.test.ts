import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrations } from '../../../../../src/shared/db/migrations.js';
import { openDatabase } from '../../../../../src/shared/db/open-database.js';
import { runMigrations } from '../../../../../src/shared/db/run-migrations.js';
import { ProjectAlreadyAddedError } from '../../../../../src/modules/projects/logic/errors/project-already-added-error.js';
import { SqliteProjectRepository } from '../../../../../src/modules/projects/infra/repositories/sqlite-project-repository.js';
import type { Project } from '../../../../../src/modules/projects/logic/domain/types/project.js';

describe('SqliteProjectRepository', () => {
  let homeDirectory: string;
  let database: DatabaseSync;
  let repository: SqliteProjectRepository;

  const project: Project = {
    id: 'moritz/aisf',
    repository: { owner: 'moritz', name: 'aisf' },
    checkoutPath: '/home/user/repo',
    addedAt: '2026-09-27T00:00:00.000Z',
  };

  beforeEach(() => {
    homeDirectory = mkdtempSync(join(tmpdir(), 'aisf-projects-'));
    database = openDatabase(join(homeDirectory, 'aisf.db'));
    runMigrations(database, migrations);
    repository = new SqliteProjectRepository(database);
  });

  afterEach(() => {
    database.close();
    rmSync(homeDirectory, { recursive: true, force: true });
  });

  describe('save', () => {
    it('should save a project that can then be found by id', async () => {
      await repository.save(project);

      expect(await repository.findById('moritz/aisf')).toEqual(project);
    });

    it('should throw ProjectAlreadyAddedError when the id is already saved', async () => {
      await repository.save(project);

      await expect(repository.save(project)).rejects.toThrow(ProjectAlreadyAddedError);
    });

    it('should survive reopening the database', async () => {
      await repository.save(project);
      database.close();

      database = openDatabase(join(homeDirectory, 'aisf.db'));
      const reopenedRepository = new SqliteProjectRepository(database);

      expect(await reopenedRepository.findById('moritz/aisf')).toEqual(project);
    });
  });

  describe('findById', () => {
    it('should return undefined when no project has that id', async () => {
      expect(await repository.findById('unknown/repo')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return an empty list when nothing has been saved', async () => {
      expect(await repository.list()).toEqual([]);
    });

    it('should return every saved project', async () => {
      const otherProject: Project = {
        id: 'moritz/other',
        repository: { owner: 'moritz', name: 'other' },
        checkoutPath: '/home/user/other',
        addedAt: '2026-09-27T01:00:00.000Z',
      };
      await repository.save(project);
      await repository.save(otherProject);

      expect(await repository.list()).toEqual(expect.arrayContaining([project, otherProject]));
    });
  });
});
