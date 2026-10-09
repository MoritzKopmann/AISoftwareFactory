import type {
  BoardRowResponse,
  SyncStatusResponse,
  TicketResponse,
  TicketStatusResponse,
} from '@aisf/app/api-schemas/tickets-schemas.js';
import { describeSyncFailure, type SyncFailureDescription } from './describe-sync-failure.js';
import type { BoardState } from './fold-board-outcome.js';
import { ticketStatusLabel } from './ticket-status-labels.js';

export type BoardRowDescription = {
  readonly key: TicketStatusResponse;
  readonly label: string;
  readonly countLabel: string;
  readonly collapsedByDefault: boolean;
  readonly truncated: boolean;
  readonly tickets: ReadonlyArray<TicketResponse>;
};

export type BoardDescription = {
  readonly banner?: SyncFailureDescription;
  readonly updatedAt?: string;
  readonly emptyMessage?: string;
  readonly loading: boolean;
  readonly rows: ReadonlyArray<BoardRowDescription>;
  readonly runningTicketNumbers: ReadonlyArray<number>;
};

function describeRow(row: BoardRowResponse): BoardRowDescription {
  const truncated = row.tickets.length < row.totalCount;
  return {
    key: row.key,
    label: ticketStatusLabel(row.key),
    countLabel: truncated ? `${row.tickets.length} of ${row.totalCount}` : `${row.totalCount}`,
    collapsedByDefault: row.key === 'closed',
    truncated,
    tickets: row.tickets,
  };
}

function describeBanner(
  state: BoardState,
  projectId: string,
  now: Date,
): SyncFailureDescription | undefined {
  switch (state.connection) {
    case 'not-watched':
      return {
        tone: 'info',
        message: `The watcher hasn't picked up ${projectId} yet. The board appears after its next poll.`,
      };
    case 'request-failed':
      return {
        tone: 'warn',
        message: "Can't reach aisf. The board retries when something changes, or on Retry.",
      };
    case 'ok':
      return state.response === undefined
        ? undefined
        : describeSyncFailure(state.response.sync, now);
  }
}

function readUpdatedAt(sync: SyncStatusResponse): string | undefined {
  switch (sync.state) {
    case 'ok':
      return sync.checkedAt;
    case 'failed':
      return sync.snapshotTakenAt;
    case 'pending':
      return undefined;
  }
}

export function describeBoard(state: BoardState, projectId: string, now: Date): BoardDescription {
  const banner = describeBanner(state, projectId, now);
  const bannerPart = banner === undefined ? {} : { banner };
  const response = state.response;
  const updatedAt = response === undefined ? undefined : readUpdatedAt(response.sync);
  const updatedAtPart = updatedAt === undefined ? {} : { updatedAt };
  const shared = { ...bannerPart, ...updatedAtPart };
  const board = response?.board;
  if (board === undefined) {
    return { ...shared, loading: true, rows: [], runningTicketNumbers: [] };
  }
  if (board.rows.every((row) => row.totalCount === 0)) {
    return {
      ...shared,
      emptyMessage: `No tickets in ${projectId} yet.`,
      loading: false,
      rows: [],
      runningTicketNumbers: [],
    };
  }
  return {
    ...shared,
    loading: false,
    rows: board.rows.map(describeRow),
    runningTicketNumbers: response?.runningTicketNumbers ?? [],
  };
}
