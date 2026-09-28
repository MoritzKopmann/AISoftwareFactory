import type {
  BoardRowResponse,
  ProjectBoardResponse,
} from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeBoard } from '../../src/board/describe-board.js';
import { buildTicketResponse } from './fixtures/ticket-response.js';

const formatTime = (isoTime: string): string => `<${isoTime}>`;
const okSync = { state: 'ok', checkedAt: 'c', snapshotTakenAt: 's' } as const;

function buildRow(
  key: BoardRowResponse['key'],
  ticketCount: number,
  totalCount = ticketCount,
): BoardRowResponse {
  const tickets = Array.from({ length: ticketCount }, (_, index) =>
    buildTicketResponse({ number: index + 1, status: key }),
  );
  return { key, tickets, totalCount };
}

function buildBoard(rows: BoardRowResponse[]): ProjectBoardResponse {
  return { projectId: 'o/n', sync: okSync, board: { rows } };
}

describe('describeBoard', () => {
  it('should show a loading status line when the sync is pending without a board', () => {
    const description = describeBoard(
      { projectId: 'o/n', sync: { state: 'pending' } },
      'o/n',
      formatTime,
    );
    expect(description.statusLine).toBe('Loading the board…');
    expect(description.rows).toEqual([]);
  });

  it('should raise the fix alert and no rows when the sync failed without a board', () => {
    const description = describeBoard(
      {
        projectId: 'o/n',
        sync: { state: 'failed', cause: 'auth', message: 'Run gh auth login.', failedAt: 'f' },
      },
      'o/n',
      formatTime,
    );
    expect(description.alert).toBe('Run gh auth login.');
    expect(description.statusLine).toBeUndefined();
    expect(description.rows).toEqual([]);
  });

  it('should still describe the rows with an alert and snapshot note when the sync failed with a board', () => {
    const description = describeBoard(
      {
        projectId: 'o/n',
        sync: {
          state: 'failed',
          cause: 'rate-limited',
          message: 'limit',
          failedAt: 'f',
          retryAt: 'r',
          snapshotTakenAt: 's',
        },
        board: { rows: [buildRow('ready', 2)] },
      },
      'o/n',
      formatTime,
    );
    expect(description.alert).toBe('GitHub rate limit reached. The app retries at <r>.');
    expect(description.snapshotNote).toBe('Showing the board from <s>');
    expect(description.rows).toHaveLength(1);
  });

  it('should give one empty message and no rows when every row is empty', () => {
    const description = describeBoard(
      buildBoard([buildRow('idea', 0), buildRow('closed', 0)]),
      'o/n',
      formatTime,
    );
    expect(description.emptyMessage).toBe('No tickets in o/n yet');
    expect(description.rows).toEqual([]);
  });

  it('should give the row a count of 0 when only that row is empty', () => {
    const description = describeBoard(
      buildBoard([buildRow('idea', 0), buildRow('ready', 1)]),
      'o/n',
      formatTime,
    );
    expect(description.emptyMessage).toBeUndefined();
    expect(description.rows[0]).toMatchObject({ key: 'idea', label: 'Idea', countLabel: '0' });
  });

  it('should keep the server order of the rows', () => {
    const description = describeBoard(
      buildBoard([buildRow('ready', 1), buildRow('idea', 1)]),
      'o/n',
      formatTime,
    );
    expect(description.rows.map((row) => row.key)).toEqual(['ready', 'idea']);
  });

  it('should read "50 of 340", collapse it and note the truncation when Closed is truncated', () => {
    const description = describeBoard(buildBoard([buildRow('closed', 50, 340)]), 'o/n', formatTime);
    const closedRow = description.rows[0];
    expect(closedRow?.countLabel).toBe('50 of 340');
    expect(closedRow?.collapsedByDefault).toBe(true);
    expect(closedRow?.truncatedNote).toBe('Showing the 50 most recent of 340');
  });

  it('should collapse only the closed row by default', () => {
    const description = describeBoard(
      buildBoard([buildRow('ready', 1), buildRow('closed', 1)]),
      'o/n',
      formatTime,
    );
    expect(description.rows.map((row) => row.collapsedByDefault)).toEqual([false, true]);
  });

  it('should warn only when the conflict row has tickets', () => {
    const withTickets = describeBoard(
      buildBoard([buildRow('conflict', 1), buildRow('ready', 1)]),
      'o/n',
      formatTime,
    );
    const withoutTickets = describeBoard(
      buildBoard([buildRow('conflict', 0), buildRow('ready', 1)]),
      'o/n',
      formatTime,
    );
    expect(withTickets.rows[0]?.warning).toBe('These tickets carry conflicting status labels.');
    expect(withTickets.rows[1]?.warning).toBeUndefined();
    expect(withoutTickets.rows[0]?.warning).toBeUndefined();
  });

  it('should show a plain count without a truncation note when nothing is cut', () => {
    const description = describeBoard(buildBoard([buildRow('ready', 3)]), 'o/n', formatTime);
    expect(description.rows[0]?.countLabel).toBe('3');
    expect(description.rows[0]?.truncatedNote).toBeUndefined();
  });
});
