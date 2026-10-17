import type { DatabaseSync } from 'node:sqlite';
import type { CommandLabelRepository } from '../../business/port/repository/command-label-repository.js';

type CommandLabelRow = {
  readonly label: string;
};

export class SqliteCommandLabelRepository implements CommandLabelRepository {
  constructor(private readonly database: DatabaseSync) {}

  async findByCommandHash(commandHash: string): Promise<string | undefined> {
    const row = this.database
      .prepare(
        `
        SELECT label
        FROM command_labels
        WHERE command_hash = ?
      `,
      )
      .get(commandHash) as CommandLabelRow | undefined;
    return row?.label;
  }

  async insert(commandHash: string, label: string): Promise<void> {
    this.database
      .prepare(
        `
        INSERT OR IGNORE INTO command_labels (command_hash, label)
        VALUES (?, ?)
      `,
      )
      .run(commandHash, label);
  }
}
