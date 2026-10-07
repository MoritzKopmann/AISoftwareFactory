import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteArtifactRepository } from '../../../../../src/modules/artifacts/infra/repositories/sqlite-artifact-repository.js';
import { migrations } from '../../../../../src/shared/db/migrations.js';
import { openDatabase } from '../../../../../src/shared/db/open-database.js';
import { runMigrations } from '../../../../../src/shared/db/run-migrations.js';
import { buildArtifact } from '../../fakes/build-artifact.js';

const { token, projectId, ticketNumber, artifactId, title, directory, runId, publishedAt } =
  buildArtifact();
const newArtifact = {
  token,
  projectId,
  ticketNumber,
  artifactId,
  title,
  directory,
  runId,
  publishedAt,
};

describe('SqliteArtifactRepository', () => {
  let homeDirectory: string;
  let database: DatabaseSync;
  let repository: SqliteArtifactRepository;

  beforeEach(() => {
    homeDirectory = mkdtempSync(join(tmpdir(), 'aisf-artifacts-'));
    database = openDatabase(join(homeDirectory, 'aisf.db'));
    runMigrations(database, migrations);
    repository = new SqliteArtifactRepository(database);
  });

  afterEach(() => {
    database.close();
    rmSync(homeDirectory, { recursive: true, force: true });
  });

  describe('publish', () => {
    it('should store the artifact at version 1 when it is new', async () => {
      const artifact = await repository.publish(newArtifact);

      expect(artifact).toEqual({ ...newArtifact, version: 1 });
      expect(await repository.findByToken('T')).toEqual(artifact);
    });

    it('should keep the token and add a version when the same artifact is published again', async () => {
      await repository.publish(newArtifact);

      const republished = await repository.publish({
        ...newArtifact,
        token: 'other',
        runId: 'r2',
        title: 'Plan review 2',
        publishedAt: '2026-10-06T11:00:00.000Z',
      });

      expect(republished).toEqual({
        ...newArtifact,
        token: 'T',
        version: 2,
        runId: 'r2',
        title: 'Plan review 2',
        publishedAt: '2026-10-06T11:00:00.000Z',
      });
      expect(await repository.findByToken('other')).toBeUndefined();
    });
  });

  describe('findByToken', () => {
    it('should return undefined when the token is unknown', async () => {
      expect(await repository.findByToken('nope')).toBeUndefined();
    });
  });

  describe('listForTicket', () => {
    it('should list the ticket artifacts in publish order when asked', async () => {
      await repository.publish(newArtifact);
      await repository.publish({ ...newArtifact, token: 'U', artifactId: 'notes' });
      await repository.publish({ ...newArtifact, token: 'V', ticketNumber: 8 });
      await repository.publish(newArtifact);

      const artifacts = await repository.listForTicket('o/n', 7);

      expect(artifacts.map(({ artifactId }) => artifactId)).toEqual(['plan', 'notes']);
    });
  });
});
