import type {
  BoardRowResponse,
  ProjectBoardResponse,
  TicketResponse,
  TicketStatusResponse,
} from '@aisf/app/api-schemas/tickets-schemas.js';
import { describeSyncFailure } from './describe-sync-failure.js';
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
  readonly statusLine?: string;
  readonly alert?: string;
  readonly snapshotNote?: string;
  readonly emptyMessage?: string;
  readonly rows: ReadonlyArray<BoardRowDescription>;
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

export function describeBoard(
  response: ProjectBoardResponse,
  projectId: string,
  formatTime: (isoTime: string) => string,
): BoardDescription {
  const alert = describeSyncFailure(response.sync, formatTime);
  const alertPart = alert === undefined ? {} : { alert };
  const board = response.board;
  if (board === undefined) {
    return {
      ...(response.sync.state === 'pending' ? { statusLine: 'Loading the board…' } : {}),
      ...alertPart,
      rows: [],
    };
  }
  const snapshotNote =
    response.sync.state === 'failed'
      ? {
          snapshotNote:
            response.sync.snapshotTakenAt === undefined
              ? 'Showing the last known board'
              : `Showing the board from ${formatTime(response.sync.snapshotTakenAt)}`,
        }
      : {};
  if (board.rows.every((row) => row.totalCount === 0)) {
    return {
      ...alertPart,
      ...snapshotNote,
      emptyMessage: `No tickets in ${projectId} yet`,
      rows: [],
    };
  }
  return { ...alertPart, ...snapshotNote, rows: board.rows.map(describeRow) };
}
