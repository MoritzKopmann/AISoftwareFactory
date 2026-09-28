import type { DatabaseSync } from 'node:sqlite';
import type { Project } from '../../logic/domain/types/project.js';
import { ProjectAlreadyAddedError } from '../../logic/errors/project-already-added-error.js';
import type { ProjectRepository } from '../../logic/ports/project-repository.js';

type ProjectRow = {
  readonly id: string;
  readonly owner: string;
  readonly name: string;
  readonly checkout_path: string;
  readonly added_at: string;
};

function toProject(row: ProjectRow): Project {
  return {
    id: String(row.id),
    repository: { owner: String(row.owner), name: String(row.name) },
    checkoutPath: String(row.checkout_path),
    addedAt: String(row.added_at),
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly database: DatabaseSync) {}

  async findById(id: string): Promise<Project | undefined> {
    const row = this.database
      .prepare(
        `
        SELECT id, owner, name, checkout_path, added_at
        FROM projects
        WHERE id = ?
      `,
      )
      .get(id) as unknown as ProjectRow | undefined;

    return row === undefined ? undefined : toProject(row);
  }

  async list(): Promise<ReadonlyArray<Project>> {
    const rows = this.database
      .prepare(
        `
        SELECT id, owner, name, checkout_path, added_at
        FROM projects
        ORDER BY added_at
      `,
      )
      .all() as unknown as ReadonlyArray<ProjectRow>;

    return rows.map(toProject);
  }

  async save(project: Project): Promise<void> {
    try {
      this.database
        .prepare(
          `
          INSERT INTO projects (id, owner, name, checkout_path, added_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        )
        .run(
          project.id,
          project.repository.owner,
          project.repository.name,
          project.checkoutPath,
          project.addedAt,
        );
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ProjectAlreadyAddedError(`${project.id} has already been added`);
      }
      throw error;
    }
  }
}
