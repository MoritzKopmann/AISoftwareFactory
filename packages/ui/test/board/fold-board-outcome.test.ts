import type { ProjectBoardResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { foldBoardOutcome, initialBoardState } from '../../src/board/fold-board-outcome.js';

const firstResponse: ProjectBoardResponse = {
  projectId: 'o/n',
  sync: { state: 'ok', checkedAt: 'first', snapshotTakenAt: 'first' },
  board: { rows: [] },
};
const secondResponse: ProjectBoardResponse = {
  projectId: 'o/n',
  sync: { state: 'ok', checkedAt: 'second', snapshotTakenAt: 'second' },
  board: { rows: [] },
};

describe('foldBoardOutcome', () => {
  it('should start with no response and a connection that is fine', () => {
    expect(initialBoardState).toEqual({ response: undefined, connection: 'ok' });
  });

  it('should take the response when the outcome is an answer', () => {
    const state = foldBoardOutcome(initialBoardState, { kind: 'answer', response: firstResponse });
    expect(state).toEqual({ response: firstResponse, connection: 'ok' });
  });

  it('should keep the last response and flag the request when it failed', () => {
    const answered = foldBoardOutcome(initialBoardState, {
      kind: 'answer',
      response: firstResponse,
    });
    const state = foldBoardOutcome(answered, { kind: 'request-failed' });
    expect(state).toEqual({ response: firstResponse, connection: 'request-failed' });
  });

  it('should clear the failure flag and replace the response on the next good answer', () => {
    const failed = foldBoardOutcome(
      foldBoardOutcome(initialBoardState, { kind: 'answer', response: firstResponse }),
      { kind: 'request-failed' },
    );
    const state = foldBoardOutcome(failed, { kind: 'answer', response: secondResponse });
    expect(state).toEqual({ response: secondResponse, connection: 'ok' });
  });

  it('should drop the response when the watcher does not know the project', () => {
    const answered = foldBoardOutcome(initialBoardState, {
      kind: 'answer',
      response: firstResponse,
    });
    const state = foldBoardOutcome(answered, { kind: 'not-watched' });
    expect(state).toEqual({ response: undefined, connection: 'not-watched' });
  });
});
