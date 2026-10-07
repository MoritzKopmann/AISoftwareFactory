import type { DatabaseSync } from 'node:sqlite';
import type { Artifact } from '../../logic/domain/types/artifact.js';
import type { ArtifactRepository, NewArtifact } from '../../logic/ports/artifact-repository.js';

type ArtifactRow = {
  readonly token: string;
  readonly project_id: string;
  readonly ticket_number: number;
  readonly artifact_id: string;
  readonly title: string;
  readonly directory: string;
  readonly run_id: string;
  readonly version: number;
  readonly published_at: string;
};

const artifactColumns = `
  token,
  project_id,
  ticket_number,
  artifact_id,
  title,
  directory,
  run_id,
  version,
  published_at
`;

function toArtifact(row: ArtifactRow): Artifact {
  return {
    token: row.token,
    projectId: row.project_id,
    ticketNumber: row.ticket_number,
    artifactId: row.artifact_id,
    title: row.title,
    directory: row.directory,
    runId: row.run_id,
    version: row.version,
    publishedAt: row.published_at,
  };
}

export class SqliteArtifactRepository implements ArtifactRepository {
  constructor(private readonly database: DatabaseSync) {}

  async publish(artifact: NewArtifact): Promise<Artifact> {
    const row = this.database
      .prepare(
        `
        INSERT INTO artifacts (${artifactColumns})
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT (project_id, ticket_number, artifact_id) DO UPDATE SET
          title = excluded.title,
          directory = excluded.directory,
          run_id = excluded.run_id,
          version = artifacts.version + 1,
          published_at = excluded.published_at
        RETURNING ${artifactColumns}
      `,
      )
      .get(
        artifact.token,
        artifact.projectId,
        artifact.ticketNumber,
        artifact.artifactId,
        artifact.title,
        artifact.directory,
        artifact.runId,
        artifact.publishedAt,
      ) as unknown as ArtifactRow;
    return toArtifact(row);
  }

  async findByToken(token: string): Promise<Artifact | undefined> {
    const row = this.database
      .prepare(`SELECT ${artifactColumns} FROM artifacts WHERE token = ?`)
      .get(token) as unknown as ArtifactRow | undefined;
    return row === undefined ? undefined : toArtifact(row);
  }

  async listForTicket(projectId: string, ticketNumber: number): Promise<ReadonlyArray<Artifact>> {
    const rows = this.database
      .prepare(
        `
        SELECT ${artifactColumns}
        FROM artifacts
        WHERE project_id = ?
          AND ticket_number = ?
        ORDER BY rowid
      `,
      )
      .all(projectId, ticketNumber) as unknown as ReadonlyArray<ArtifactRow>;
    return rows.map(toArtifact);
  }
}
