import type { FindingResponse } from '@aisf/app/api-schemas/findings-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describeKnownBugs,
  type KnownBugsDescription,
} from '../../src/findings/describe-known-bugs.js';
import { initialFindingsPoll } from '../../src/findings/fold-findings-poll.js';
import { buildFindingResponse } from './fixtures/finding-response.js';

const projectId = 'MoritzKopmann/postkarte';
const answeredAt = new Date(2026, 8, 30, 9, 41, 12).toISOString();

function buildFindings(count: number): ReadonlyArray<FindingResponse> {
  return Array.from({ length: count }, (_, index) => buildFindingResponse({ id: index + 1 }));
}

function listedIds(description: KnownBugsDescription): ReadonlyArray<number> {
  return description.kind === 'list' ? description.rows.map((row) => row.id) : [];
}

describe('describeKnownBugs', () => {
  it('should describe loading when no poll has come back yet', () => {
    expect(describeKnownBugs(initialFindingsPoll, projectId, false)).toEqual({ kind: 'loading' });
  });

  it("should say aisf can't be reached and keep the error message when the first fetch throws", () => {
    const description = describeKnownBugs(
      { failure: { kind: 'unreachable', message: 'Failed to fetch' } },
      projectId,
      false,
    );

    expect(description).toEqual({
      kind: 'error',
      message: "Couldn't load known bugs. Can't reach aisf.",
      detail: 'Failed to fetch',
    });
  });

  it('should name the status when the first fetch gets a non-OK answer', () => {
    const description = describeKnownBugs(
      { failure: { kind: 'not-ok', status: 500 } },
      projectId,
      false,
    );

    expect(description).toEqual({
      kind: 'error',
      message: "Couldn't load known bugs. The findings route answered 500.",
      detail: '500',
    });
  });

  it('should describe empty when no finding is open or creating', () => {
    const description = describeKnownBugs(
      {
        findings: [
          buildFindingResponse({ id: 1, state: 'ticketed', createdTicketNumber: 212 }),
          buildFindingResponse({ id: 2, state: 'dismissed' }),
        ],
        answeredAt: '2026-09-30T09:41:00Z',
      },
      projectId,
      false,
    );

    expect(description).toEqual({ kind: 'empty' });
  });

  it('should list and count the open and creating findings in the order the route returned them', () => {
    const description = describeKnownBugs(
      {
        findings: [
          buildFindingResponse({ id: 3, state: 'open' }),
          buildFindingResponse({ id: 4, state: 'dismissed' }),
          buildFindingResponse({ id: 7, state: 'creating' }),
          buildFindingResponse({ id: 9, state: 'ticketed', createdTicketNumber: 212 }),
          buildFindingResponse({ id: 12, state: 'open' }),
        ],
        answeredAt,
      },
      projectId,
      false,
    );

    expect(description).toMatchObject({ kind: 'list', countLabel: '3' });
    expect(listedIds(description)).toEqual([3, 7, 12]);
    expect(description).not.toHaveProperty('banner');
    expect(description).not.toHaveProperty('footer');
  });

  it('should describe a bug row with its chip, summary, location and the link to its source ticket', () => {
    const description = describeKnownBugs(
      {
        findings: [
          buildFindingResponse({
            id: 3,
            kind: 'bug',
            ticketNumber: 56,
            summary: 'The retry counter is never reset.',
            location: 'packages/app/src/retry-policy.ts:42',
          }),
        ],
        answeredAt,
      },
      projectId,
      false,
    );

    expect(description).toMatchObject({
      rows: [
        {
          id: 3,
          chipLabel: 'Bug',
          chipTone: 'danger',
          summary: 'The retry counter is never reset.',
          location: 'packages/app/src/retry-policy.ts:42',
          sourceLabel: '#56',
          sourceHref: '#/projects/MoritzKopmann/postkarte/tickets/56',
        },
      ],
    });
  });

  it('should describe a gap row with the Gap chip in the warn tone', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ kind: 'gap' })], answeredAt },
      projectId,
      false,
    );

    expect(description).toMatchObject({ rows: [{ chipLabel: 'Gap', chipTone: 'warn' }] });
  });

  it('should keep the list and name the time of the last good answer when a later poll fails', () => {
    const description = describeKnownBugs(
      {
        findings: [buildFindingResponse({ id: 3 })],
        answeredAt,
        failure: { kind: 'unreachable', message: 'Failed to fetch' },
      },
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual([3]);
    expect(description).toMatchObject({
      banner: "Can't reach aisf. Showing the list from 09:41; trying again every 5 s.",
    });
  });

  it('should show the first 20 rows, the full count and a footer when more than 20 are listed', () => {
    const description = describeKnownBugs(
      { findings: buildFindings(34), answeredAt },
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(description).toMatchObject({ countLabel: '34', footer: 'Showing 20 of 34.' });
  });

  it('should list every row without a footer when the viewer chose Show all', () => {
    const description = describeKnownBugs(
      { findings: buildFindings(34), answeredAt },
      projectId,
      true,
    );

    expect(listedIds(description)).toHaveLength(34);
    expect(description).not.toHaveProperty('footer');
  });

  it('should show every row without a footer when exactly 20 are listed', () => {
    const description = describeKnownBugs(
      { findings: buildFindings(20), answeredAt },
      projectId,
      false,
    );

    expect(listedIds(description)).toHaveLength(20);
    expect(description).not.toHaveProperty('footer');
  });
});
