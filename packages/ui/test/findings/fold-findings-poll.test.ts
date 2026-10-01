import { describe, expect, it } from 'vitest';
import {
  foldFindingsPoll,
  initialFindingsPoll,
  type FindingsPoll,
} from '../../src/findings/fold-findings-poll.js';
import { buildFindingResponse } from './fixtures/finding-response.js';

const firstFindings = [buildFindingResponse({ id: 1 })];
const answered: FindingsPoll = { findings: firstFindings, answeredAt: '2026-09-30T09:41:00Z' };

describe('foldFindingsPoll', () => {
  it('should take the findings and their arrival time when the poll answers', () => {
    const poll = foldFindingsPoll(
      initialFindingsPoll,
      { kind: 'answer', findings: firstFindings },
      '2026-09-30T09:41:00Z',
    );

    expect(poll).toEqual(answered);
  });

  it('should keep the last findings and their arrival time and hold the failure when the poll fails', () => {
    const failed = foldFindingsPoll(
      answered,
      { kind: 'unreachable', message: 'Failed to fetch' },
      '2026-09-30T09:41:05Z',
    );

    expect(failed).toEqual({
      ...answered,
      failure: { kind: 'unreachable', message: 'Failed to fetch' },
    });
  });

  it('should hold the failure without findings when the first poll fails', () => {
    const failed = foldFindingsPoll(
      initialFindingsPoll,
      { kind: 'not-ok', status: 500 },
      '2026-09-30T09:41:05Z',
    );

    expect(failed).toEqual({ failure: { kind: 'not-ok', status: 500 } });
  });

  it('should take the new findings and clear the failure when the next poll answers', () => {
    const failed = foldFindingsPoll(
      answered,
      { kind: 'not-ok', status: 500 },
      '2026-09-30T09:41:05Z',
    );
    const secondFindings = [buildFindingResponse({ id: 1 }), buildFindingResponse({ id: 2 })];

    const recovered = foldFindingsPoll(
      failed,
      { kind: 'answer', findings: secondFindings },
      '2026-09-30T09:41:10Z',
    );

    expect(recovered).toEqual({ findings: secondFindings, answeredAt: '2026-09-30T09:41:10Z' });
  });
});
