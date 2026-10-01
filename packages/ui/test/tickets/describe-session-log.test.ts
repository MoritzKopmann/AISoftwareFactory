import type { SessionLogResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeSessionLog } from '../../src/tickets/describe-session-log.js';

function found(entryCount: number, total: number): SessionLogResponse {
  return {
    kind: 'found',
    entries: Array.from({ length: entryCount }, (_, position) => ({
      summary: `Step ${total - entryCount + position + 1}`,
    })),
    total,
  };
}

function describeAnswer(response: SessionLogResponse) {
  return describeSessionLog({ kind: 'answer', response });
}

describe('describeSessionLog', () => {
  it('should describe a closed section when the log is closed', () => {
    expect(describeSessionLog({ kind: 'closed' })).toEqual({ kind: 'closed' });
  });

  it('should describe loading with its announcement when the log is waiting for the route', () => {
    expect(describeSessionLog({ kind: 'loading' })).toEqual({
      kind: 'loading',
      loadingLabel: 'Loading the session log…',
    });
  });

  it('should number the entries 1 to 12 oldest first and count 12 when all 12 entries came back', () => {
    const description = describeAnswer(found(12, 12));
    expect(description).toMatchObject({ kind: 'entries', countLabel: '12' });
    expect(description).not.toHaveProperty('note');
    expect(description.kind === 'entries' && description.entries).toEqual(
      Array.from({ length: 12 }, (_, position) => ({
        indexLabel: String(position + 1),
        summary: `Step ${position + 1}`,
      })),
    );
  });

  it('should lead with the last-200 note, count 1,284 and number from 1085 to 1284 when 200 of 1,284 entries came back', () => {
    const description = describeAnswer(found(200, 1284));
    expect(description).toMatchObject({
      kind: 'entries',
      countLabel: '1,284',
      note: 'Showing last 200 of 1,284.',
    });
    const entries = description.kind === 'entries' ? description.entries : [];
    expect(entries).toHaveLength(200);
    expect(entries[0]).toEqual({ indexLabel: '1085', summary: 'Step 1085' });
    expect(entries[199]).toEqual({ indexLabel: '1284', summary: 'Step 1284' });
  });

  it('should say no session yet as a quiet message when no run has started', () => {
    expect(describeAnswer({ kind: 'no-session' })).toEqual({
      kind: 'message',
      message: 'No session yet. A run on this ticket starts one.',
    });
  });

  it('should say the transcript was not found as a quiet message when Claude Code removed it', () => {
    expect(describeAnswer({ kind: 'transcript-not-found' })).toEqual({
      kind: 'message',
      message: "Transcript not found. Claude Code has removed this session's transcript.",
    });
  });

  it('should say no entries yet as a quiet message when the session has written nothing', () => {
    expect(describeAnswer(found(0, 0))).toEqual({ kind: 'message', message: 'No entries yet.' });
  });

  it("should say it can't reach aisf with the error's message as the detail when the request failed", () => {
    expect(describeSessionLog({ kind: 'request-failed', message: 'Failed to fetch' })).toEqual({
      kind: 'failed',
      message: "Couldn't load the session log. Can't reach aisf.",
      detail: 'Failed to fetch',
    });
  });

  it('should name the status the route answered with the status alone as the detail when the route answered an error', () => {
    expect(describeSessionLog({ kind: 'answered-error', status: 500 })).toEqual({
      kind: 'failed',
      message: "Couldn't load the session log. The session log route answered 500.",
      detail: '500',
    });
  });
});
