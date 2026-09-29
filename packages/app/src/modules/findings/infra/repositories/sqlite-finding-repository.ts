import type { DatabaseSync } from 'node:sqlite';
import type { Finding, FindingKind, FindingState } from '../../logic/domain/types/finding.js';
import type { FindingRepository, NewFinding } from '../../logic/ports/finding-repository.js';

type FindingRow = {
  readonly id: number;
  readonly project_id: string;
  readonly ticket_number: number;
  readonly run_id: string;
  readonly kind: string;
  readonly location: string;
  readonly summary: string;
  readonly state: string;
  readonly created_ticket_number: number | null;
  readonly reported_at: string;
  readonly resolved_at: string | null;
};

const selectFindingColumns = `
  SELECT
    id,
    project_id,
    ticket_number,
    run_id,
    kind,
    location,
    summary,
    state,
    created_ticket_number,
    reported_at,
    resolved_at
  FROM findings
`;

function toFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    projectId: row.project_id,
    ticketNumber: row.ticket_number,
    runId: row.run_id,
    kind: row.kind as FindingKind,
    location: row.location,
    summary: row.summary,
    state: row.state as FindingState,
    ...(row.created_ticket_number === null
      ? {}
      : { createdTicketNumber: row.created_ticket_number }),
    reportedAt: row.reported_at,
    ...(row.resolved_at === null ? {} : { resolvedAt: row.resolved_at }),
  };
}

export class SqliteFindingRepository implements FindingRepository {
  constructor(private readonly database: DatabaseSync) {}

  async insert(newFinding: NewFinding): Promise<Finding> {
    const result = this.database
      .prepare(
        `
        INSERT INTO findings (
          project_id,
          ticket_number,
          run_id,
          kind,
          location,
          summary,
          state,
          reported_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
      `,
      )
      .run(
        newFinding.projectId,
        newFinding.ticketNumber,
        newFinding.runId,
        newFinding.kind,
        newFinding.location,
        newFinding.summary,
        newFinding.reportedAt,
      );

    return { ...newFinding, id: Number(result.lastInsertRowid), state: 'open' };
  }

  async findById(findingId: number): Promise<Finding | undefined> {
    const row = this.database
      .prepare(
        `
        ${selectFindingColumns}
        WHERE id = ?
      `,
      )
      .get(findingId) as unknown as FindingRow | undefined;

    return row === undefined ? undefined : toFinding(row);
  }

  async list(projectId: string, ticketNumber?: number): Promise<ReadonlyArray<Finding>> {
    const rows = this.database
      .prepare(
        `
        ${selectFindingColumns}
        WHERE project_id = ?
          AND (? IS NULL OR ticket_number = ?)
        ORDER BY id
      `,
      )
      .all(
        projectId,
        ticketNumber ?? null,
        ticketNumber ?? null,
      ) as unknown as ReadonlyArray<FindingRow>;

    return rows.map(toFinding);
  }

  async claimForTicketing(findingId: number): Promise<'claimed' | 'not-open'> {
    const result = this.database
      .prepare(
        `
        UPDATE findings
        SET state = 'creating'
        WHERE id = ?
          AND state = 'open'
      `,
      )
      .run(findingId);

    return result.changes === 0 ? 'not-open' : 'claimed';
  }

  async releaseClaim(findingId: number): Promise<void> {
    this.database
      .prepare(
        `
        UPDATE findings
        SET state = 'open'
        WHERE id = ?
          AND state = 'creating'
      `,
      )
      .run(findingId);
  }

  async markTicketed(
    findingId: number,
    createdTicketNumber: number,
    resolvedAt: string,
  ): Promise<void> {
    this.database
      .prepare(
        `
        UPDATE findings
        SET state = 'ticketed',
          created_ticket_number = ?,
          resolved_at = ?
        WHERE id = ?
      `,
      )
      .run(createdTicketNumber, resolvedAt, findingId);
  }

  async dismiss(findingId: number, resolvedAt: string): Promise<'dismissed' | 'not-open'> {
    const result = this.database
      .prepare(
        `
        UPDATE findings
        SET state = 'dismissed',
          resolved_at = ?
        WHERE id = ?
          AND state = 'open'
      `,
      )
      .run(resolvedAt, findingId);

    return result.changes === 0 ? 'not-open' : 'dismissed';
  }
}
