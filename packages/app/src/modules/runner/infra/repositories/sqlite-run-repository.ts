import type { DatabaseSync } from 'node:sqlite';
import type { Run } from '../../logic/domain/types/run.js';
import type { RunEnding } from '../../logic/domain/types/run-ending.js';
import type { RunMode } from '../../logic/domain/types/run-mode.js';
import type { RunStage } from '../../logic/domain/types/run-stage.js';
import { RunAlreadyActiveError } from '../../logic/errors/run-already-active-error.js';
import type { RunRepository } from '../../logic/ports/run-repository.js';

type RunRow = {
  readonly id: string;
  readonly project_id: string;
  readonly ticket_number: number;
  readonly stage: string;
  readonly mode: string;
  readonly session_id: string;
  readonly worktree_path: string;
  readonly branch_name: string;
  readonly state: string;
  readonly ending_kind: string | null;
  readonly ending_reason: string | null;
  readonly escalation_kind: string | null;
  readonly blocker_number: number | null;
  readonly tool_name: string | null;
  readonly tool_input: string | null;
  readonly started_at: string;
  readonly ended_at: string | null;
};

const selectRunColumns = `
  SELECT
    id,
    project_id,
    ticket_number,
    stage,
    mode,
    session_id,
    worktree_path,
    branch_name,
    state,
    ending_kind,
    ending_reason,
    escalation_kind,
    blocker_number,
    tool_name,
    tool_input,
    started_at,
    ended_at
  FROM runs
`;

function toEnding(row: RunRow): RunEnding | undefined {
  switch (row.ending_kind) {
    case 'escalated':
      return {
        kind: 'escalated',
        escalation: row.escalation_kind as 'red' | 'spec' | 'denied',
        reason: String(row.ending_reason),
      };
    case 'permission-needed':
      return {
        kind: 'permission-needed',
        toolName: String(row.tool_name),
        toolInput: JSON.parse(String(row.tool_input)) as Record<string, unknown>,
      };
    case 'parked':
      return { kind: 'parked', blockerNumber: Number(row.blocker_number) };
    case 'crashed':
      return { kind: 'crashed', reason: String(row.ending_reason) };
    case 'usage-limit':
      return { kind: 'usage-limit', reason: String(row.ending_reason) };
    case 'finished':
    case 'stopped':
    case 'app-restarted':
      return { kind: row.ending_kind };
    default:
      return undefined;
  }
}

function toRun(row: RunRow): Run {
  const ending = toEnding(row);
  return {
    id: row.id,
    projectId: row.project_id,
    ticketNumber: row.ticket_number,
    stage: row.stage as RunStage,
    mode: row.mode as RunMode,
    sessionId: row.session_id,
    worktreePath: row.worktree_path,
    branchName: row.branch_name,
    state: row.state as Run['state'],
    ...(ending === undefined ? {} : { ending }),
    startedAt: row.started_at,
    ...(row.ended_at === null ? {} : { endedAt: row.ended_at }),
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

export class SqliteRunRepository implements RunRepository {
  constructor(private readonly database: DatabaseSync) {}

  async insert(run: Run): Promise<void> {
    try {
      this.database
        .prepare(
          `
          INSERT INTO runs (
            id,
            project_id,
            ticket_number,
            stage,
            mode,
            session_id,
            worktree_path,
            branch_name,
            state,
            started_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          run.id,
          run.projectId,
          run.ticketNumber,
          run.stage,
          run.mode,
          run.sessionId,
          run.worktreePath,
          run.branchName,
          run.state,
          run.startedAt,
        );
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new RunAlreadyActiveError(`${run.projectId} already has a running run`);
      }
      throw error;
    }
  }

  async findById(runId: string): Promise<Run | undefined> {
    const row = this.database
      .prepare(
        `
        ${selectRunColumns}
        WHERE id = ?
      `,
      )
      .get(runId) as unknown as RunRow | undefined;

    return row === undefined ? undefined : toRun(row);
  }

  async findActive(projectId: string): Promise<Run | undefined> {
    const row = this.database
      .prepare(
        `
        ${selectRunColumns}
        WHERE project_id = ?
          AND state = 'running'
      `,
      )
      .get(projectId) as unknown as RunRow | undefined;

    return row === undefined ? undefined : toRun(row);
  }

  async listByState(state: Run['state']): Promise<ReadonlyArray<Run>> {
    const rows = this.database
      .prepare(
        `
        ${selectRunColumns}
        WHERE state = ?
        ORDER BY started_at
      `,
      )
      .all(state) as unknown as ReadonlyArray<RunRow>;

    return rows.map(toRun);
  }

  async recordEnding(
    runId: string,
    ending: RunEnding,
    endedAt: string,
  ): Promise<'recorded' | 'already-ended'> {
    const result = this.database
      .prepare(
        `
        UPDATE runs
        SET state = 'ended',
          ending_kind = ?,
          ending_reason = ?,
          escalation_kind = ?,
          blocker_number = ?,
          tool_name = ?,
          tool_input = ?,
          ended_at = ?
        WHERE id = ?
          AND state = 'running'
      `,
      )
      .run(
        ending.kind,
        'reason' in ending ? ending.reason : null,
        ending.kind === 'escalated' ? ending.escalation : null,
        ending.kind === 'parked' ? ending.blockerNumber : null,
        ending.kind === 'permission-needed' ? ending.toolName : null,
        ending.kind === 'permission-needed' ? JSON.stringify(ending.toolInput) : null,
        endedAt,
        runId,
      );

    return result.changes === 0 ? 'already-ended' : 'recorded';
  }

  async markSettled(runId: string, settledAt: string): Promise<void> {
    this.database
      .prepare(
        `
        UPDATE runs
        SET state = 'settled',
          settled_at = ?
        WHERE id = ?
          AND state = 'ended'
      `,
      )
      .run(settledAt, runId);
  }
}
