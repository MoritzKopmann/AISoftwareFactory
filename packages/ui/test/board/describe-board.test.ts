import type {
  BoardRowResponse,
  ProjectBoardResponse,
} from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeBoard } from '../../src/board/describe-board.js';
import { initialBoardState, type BoardState } from '../../src/board/fold-board-outcome.js';
import { buildTicketResponse } from './fixtures/ticket-response.js';

const now = new Date('2026-09-28T10:00:00.000Z');
const okSync = { state: 'ok', checkedAt: 'checked', snapshotTakenAt: 'snapshot' } as const;

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

function answered(response: ProjectBoardResponse): BoardState {
  return { response, connection: 'ok' };
}

describe('describeBoard', () => {
  it('should be loading without a banner or an updated time before the first answer', () => {
    const description = describeBoard(initialBoardState, 'o/n', now);
    expect(description).toEqual({ loading: true, rows: [] });
  });

  it('should be loading without an updated time when the sync is pending', () => {
    const description = describeBoard(
      answered({ projectId: 'o/n', sync: { state: 'pending' } }),
      'o/n',
      now,
    );
    expect(description).toEqual({ loading: true, rows: [] });
  });

  it('should take the checked time as the updated time when the sync is ok', () => {
    const description = describeBoard(answered(buildBoard([buildRow('ready', 1)])), 'o/n', now);
    expect(description.updatedAt).toBe('checked');
    expect(description.loading).toBe(false);
    expect(description.banner).toBeUndefined();
  });

  it('should keep the rows, take the snapshot time and raise the banner when the sync failed with a board', () => {
    const description = describeBoard(
      answered({
        projectId: 'o/n',
        sync: {
          state: 'failed',
          cause: 'unavailable',
          message: 'GitHub is down.',
          failedAt: 'failed',
          snapshotTakenAt: 'old snapshot',
        },
        board: { rows: [buildRow('ready', 2)] },
      }),
      'o/n',
      now,
    );
    expect(description.banner).toMatchObject({ tone: 'warn', detail: 'GitHub is down.' });
    expect(description.updatedAt).toBe('old snapshot');
    expect(description.rows).toHaveLength(1);
    expect(description.loading).toBe(false);
  });

  it('should raise the banner, show no updated time and keep loading when the sync failed without a board', () => {
    const description = describeBoard(
      answered({
        projectId: 'o/n',
        sync: { state: 'failed', cause: 'auth', message: 'Run gh auth login.', failedAt: 'f' },
      }),
      'o/n',
      now,
    );
    expect(description.banner?.command).toBe('gh auth login');
    expect(description.updatedAt).toBeUndefined();
    expect(description.loading).toBe(true);
    expect(description.rows).toEqual([]);
  });

  it('should raise the info banner over the loading state when the watcher does not know the project', () => {
    const description = describeBoard(
      { response: undefined, connection: 'not-watched' },
      'o/n',
      now,
    );
    expect(description.banner).toEqual({
      tone: 'info',
      message: "The watcher hasn't picked up o/n yet. The board appears after its next poll.",
    });
    expect(description.loading).toBe(true);
    expect(description.updatedAt).toBeUndefined();
  });

  it('should raise the warn banner and keep the board and updated time when the request failed', () => {
    const description = describeBoard(
      { response: buildBoard([buildRow('ready', 1)]), connection: 'request-failed' },
      'o/n',
      now,
    );
    expect(description.banner).toEqual({
      tone: 'warn',
      message: "Can't reach aisf. The board tries again every 5 s.",
    });
    expect(description.updatedAt).toBe('checked');
    expect(description.rows).toHaveLength(1);
  });

  it('should show the request banner instead of the sync banner when both apply', () => {
    const failedSync: ProjectBoardResponse = {
      projectId: 'o/n',
      sync: { state: 'failed', cause: 'auth', message: 'm', failedAt: 'f' },
      board: { rows: [buildRow('ready', 1)] },
    };
    const description = describeBoard(
      { response: failedSync, connection: 'request-failed' },
      'o/n',
      now,
    );
    expect(description.banner?.message).toBe("Can't reach aisf. The board tries again every 5 s.");
  });

  it('should give one empty message with a full stop and no rows when every row is empty', () => {
    const description = describeBoard(
      answered(buildBoard([buildRow('idea', 0), buildRow('closed', 0)])),
      'o/n',
      now,
    );
    expect(description.emptyMessage).toBe('No tickets in o/n yet.');
    expect(description.rows).toEqual([]);
    expect(description.loading).toBe(false);
  });

  it('should give the row a count of 0 when only that row is empty', () => {
    const description = describeBoard(
      answered(buildBoard([buildRow('idea', 0), buildRow('ready', 1)])),
      'o/n',
      now,
    );
    expect(description.emptyMessage).toBeUndefined();
    expect(description.rows[0]).toMatchObject({ key: 'idea', label: 'Idea', countLabel: '0' });
  });

  it('should keep the server order of the rows', () => {
    const description = describeBoard(
      answered(buildBoard([buildRow('ready', 1), buildRow('idea', 1)])),
      'o/n',
      now,
    );
    expect(description.rows.map((row) => row.key)).toEqual(['ready', 'idea']);
  });

  it('should read "50 of 340", collapse it and flag the truncation when Closed is truncated', () => {
    const description = describeBoard(
      answered(buildBoard([buildRow('closed', 50, 340)])),
      'o/n',
      now,
    );
    const closedRow = description.rows[0];
    expect(closedRow?.countLabel).toBe('50 of 340');
    expect(closedRow?.collapsedByDefault).toBe(true);
    expect(closedRow?.truncated).toBe(true);
  });

  it('should collapse only the closed row by default', () => {
    const description = describeBoard(
      answered(buildBoard([buildRow('ready', 1), buildRow('closed', 1)])),
      'o/n',
      now,
    );
    expect(description.rows.map((row) => row.collapsedByDefault)).toEqual([false, true]);
  });

  it('should leave the fixed notes to the component when the conflict row has tickets', () => {
    const description = describeBoard(
      answered(buildBoard([buildRow('conflict', 1), buildRow('closed', 50, 340)])),
      'o/n',
      now,
    );
    expect(description.rows[0]).not.toHaveProperty('warning');
    expect(description.rows[1]).not.toHaveProperty('truncatedNote');
  });

  it('should show a plain count and no truncation when nothing is cut', () => {
    const description = describeBoard(answered(buildBoard([buildRow('ready', 3)])), 'o/n', now);
    expect(description.rows[0]?.countLabel).toBe('3');
    expect(description.rows[0]?.truncated).toBe(false);
  });

  it('should pass the running ticket number through when the board has a live run', () => {
    const description = describeBoard(
      answered({ ...buildBoard([buildRow('in-progress', 2)]), runningTicketNumber: 2 }),
      'o/n',
      now,
    );
    expect(description.runningTicketNumber).toBe(2);
  });
});
