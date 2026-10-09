import type { FindingResponse } from '@aisf/app/api-schemas/findings-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describeKnownBugs,
  type FindingPress,
  type KnownBugRow,
  type KnownBugsDescription,
} from '../../src/findings/describe-known-bugs.js';
import { initialFindingsPoll } from '../../src/findings/fold-findings-poll.js';
import { buildFindingResponse } from './fixtures/finding-response.js';

const projectId = 'MoritzKopmann/postkarte';
const answeredAt = new Date(2026, 8, 30, 9, 41, 12).toISOString();

const noPresses: ReadonlyMap<number, FindingPress> = new Map();

function buildFindings(count: number): ReadonlyArray<FindingResponse> {
  return Array.from({ length: count }, (_, index) => buildFindingResponse({ id: index + 1 }));
}

function listedIds(description: KnownBugsDescription): ReadonlyArray<number> {
  return description.kind === 'list' ? description.rows.map((row) => row.id) : [];
}

function rowAction(
  description: KnownBugsDescription,
  findingId: number,
): KnownBugRow['action'] | undefined {
  return description.kind === 'list'
    ? description.rows.find((row) => row.id === findingId)?.action
    : undefined;
}

function describeAfterPress(press: FindingPress, state: FindingResponse['state'] = 'open') {
  return describeKnownBugs(
    {
      findings: [buildFindingResponse({ id: 3 }), buildFindingResponse({ id: 7, state })],
      answeredAt,
    },
    new Map([[7, press]]),
    projectId,
    false,
  );
}

describe('describeKnownBugs', () => {
  it('should describe loading when no poll has come back yet', () => {
    expect(describeKnownBugs(initialFindingsPoll, noPresses, projectId, false)).toEqual({
      kind: 'loading',
    });
  });

  it("should say aisf can't be reached and keep the error message when the first fetch throws", () => {
    const description = describeKnownBugs(
      { failure: { kind: 'unreachable', message: 'Failed to fetch' } },
      noPresses,
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
      noPresses,
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
      noPresses,
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
      noPresses,
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
      noPresses,
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
          source: { label: '#56', href: '#/projects/MoritzKopmann/postkarte/tickets/56' },
        },
      ],
    });
  });

  it('should leave the source out of a row when the list is for one ticket', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 3, ticketNumber: 56 })], answeredAt },
      noPresses,
      projectId,
      false,
      56,
    );

    expect(listedIds(description)).toEqual([3]);
    expect(description.kind === 'list' ? description.rows[0] : undefined).not.toHaveProperty(
      'source',
    );
  });

  it('should describe a gap row with the Gap chip in the warn tone', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ kind: 'gap' })], answeredAt },
      noPresses,
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
      noPresses,
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual([3]);
    expect(description).toMatchObject({
      banner:
        "Can't reach aisf. Showing the list from 09:41. Loads again on the next change, or on Retry.",
    });
  });

  it('should show the first 20 rows, the full count and a footer when more than 20 are listed', () => {
    const description = describeKnownBugs(
      { findings: buildFindings(34), answeredAt },
      noPresses,
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(description).toMatchObject({ countLabel: '34', footer: 'Showing 20 of 34.' });
  });

  it('should list every row without a footer when the viewer chose Show all', () => {
    const description = describeKnownBugs(
      { findings: buildFindings(34), answeredAt },
      noPresses,
      projectId,
      true,
    );

    expect(listedIds(description)).toHaveLength(34);
    expect(description).not.toHaveProperty('footer');
  });

  it('should show every row without a footer when exactly 20 are listed', () => {
    const description = describeKnownBugs(
      { findings: buildFindings(20), answeredAt },
      noPresses,
      projectId,
      false,
    );

    expect(listedIds(description)).toHaveLength(20);
    expect(description).not.toHaveProperty('footer');
  });

  it('should leave an open row idle when nothing was pressed', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 3 })], answeredAt },
      noPresses,
      projectId,
      false,
    );

    expect(rowAction(description, 3)).toEqual({ kind: 'idle' });
  });

  it('should lock the row as creating when the poll reports the finding as creating', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 3, state: 'creating' })], answeredAt },
      noPresses,
      projectId,
      false,
    );

    expect(rowAction(description, 3)).toEqual({ kind: 'creating' });
  });

  it('should lock the row as creating when Create ticket was pressed and no answer came yet', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 3 })], answeredAt },
      new Map([[3, { kind: 'creating' }]]),
      projectId,
      false,
    );

    expect(rowAction(description, 3)).toEqual({ kind: 'creating' });
  });

  it('should lock the row as dismissing when Dismiss was pressed and no answer came yet', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 3 })], answeredAt },
      new Map([[3, { kind: 'dismissing' }]]),
      projectId,
      false,
    );

    expect(rowAction(description, 3)).toEqual({ kind: 'dismissing' });
  });

  it('should keep a row ticketed by a press in its place, linked to the new ticket and left out of the count', () => {
    const description = describeKnownBugs(
      {
        findings: [
          buildFindingResponse({ id: 3 }),
          buildFindingResponse({ id: 7, state: 'ticketed', createdTicketNumber: 212 }),
          buildFindingResponse({ id: 12 }),
        ],
        answeredAt,
      },
      new Map([[7, { kind: 'created', ticketNumber: 212 }]]),
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual([3, 7, 12]);
    expect(description).toMatchObject({ countLabel: '2' });
    expect(rowAction(description, 7)).toEqual({
      kind: 'created',
      ticketLabel: '#212',
      ticketHref: '#/projects/MoritzKopmann/postkarte/tickets/212',
    });
  });

  it('should show the created row and drop it from the count when the last poll still reports it open', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 3 }), buildFindingResponse({ id: 7 })], answeredAt },
      new Map([[7, { kind: 'created', ticketNumber: 212 }]]),
      projectId,
      false,
    );

    expect(description).toMatchObject({ countLabel: '1' });
    expect(rowAction(description, 7)).toMatchObject({ kind: 'created' });
  });

  it('should keep the list with a count of 0 when the only row left was ticketed by a press', () => {
    const description = describeKnownBugs(
      {
        findings: [buildFindingResponse({ id: 7, state: 'ticketed', createdTicketNumber: 212 })],
        answeredAt,
      },
      new Map([[7, { kind: 'created', ticketNumber: 212 }]]),
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual([7]);
    expect(description).toMatchObject({ countLabel: '0' });
  });

  it('should drop a dismissed row and its count at once when the last poll still reports it open', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 3 }), buildFindingResponse({ id: 7 })], answeredAt },
      new Map([[7, { kind: 'dismissed' }]]),
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual([3]);
    expect(description).toMatchObject({ countLabel: '1' });
  });

  it('should describe empty when the only open finding was dismissed by a press', () => {
    const description = describeKnownBugs(
      { findings: [buildFindingResponse({ id: 7 })], answeredAt },
      new Map([[7, { kind: 'dismissed' }]]),
      projectId,
      false,
    );

    expect(description).toEqual({ kind: 'empty' });
  });

  it('should name the status when Create ticket got a non-OK answer', () => {
    const description = describeAfterPress({
      kind: 'failed',
      action: 'create-ticket',
      failure: { kind: 'not-ok', status: 500 },
    });

    expect(rowAction(description, 7)).toEqual({
      kind: 'failed',
      message: "Couldn't create the ticket. The findings route answered 500.",
      detail: '500',
    });
  });

  it('should say the finding is already ticketed or dismissed when Create ticket got a 409', () => {
    const description = describeAfterPress({
      kind: 'failed',
      action: 'create-ticket',
      failure: { kind: 'not-ok', status: 409 },
    });

    expect(rowAction(description, 7)).toEqual({
      kind: 'failed',
      message: "Couldn't create the ticket. It is already ticketed or dismissed.",
      detail: '409',
    });
  });

  it("should say aisf can't be reached and keep the error message when Create ticket got no answer", () => {
    const description = describeAfterPress({
      kind: 'failed',
      action: 'create-ticket',
      failure: { kind: 'unreachable', message: 'Failed to fetch' },
    });

    expect(rowAction(description, 7)).toEqual({
      kind: 'failed',
      message: "Couldn't create the ticket. Can't reach aisf.",
      detail: 'Failed to fetch',
    });
  });

  it('should name the status when Dismiss got a non-OK answer', () => {
    const description = describeAfterPress({
      kind: 'failed',
      action: 'dismiss',
      failure: { kind: 'not-ok', status: 500 },
    });

    expect(rowAction(description, 7)).toEqual({
      kind: 'failed',
      message: "Couldn't dismiss the finding. The findings route answered 500.",
      detail: '500',
    });
  });

  it('should say the finding is already ticketed or dismissed when Dismiss got a 409', () => {
    const description = describeAfterPress({
      kind: 'failed',
      action: 'dismiss',
      failure: { kind: 'not-ok', status: 409 },
    });

    expect(rowAction(description, 7)).toEqual({
      kind: 'failed',
      message: "Couldn't dismiss the finding. It is already ticketed or dismissed.",
      detail: '409',
    });
  });

  it("should say aisf can't be reached and keep the error message when Dismiss got no answer", () => {
    const description = describeAfterPress({
      kind: 'failed',
      action: 'dismiss',
      failure: { kind: 'unreachable', message: 'Failed to fetch' },
    });

    expect(rowAction(description, 7)).toEqual({
      kind: 'failed',
      message: "Couldn't dismiss the finding. Can't reach aisf.",
      detail: 'Failed to fetch',
    });
  });

  it('should keep the row counted when its press failed', () => {
    const description = describeAfterPress({
      kind: 'failed',
      action: 'create-ticket',
      failure: { kind: 'not-ok', status: 500 },
    });

    expect(description).toMatchObject({ countLabel: '2' });
  });

  it('should lock the row as creating when the press failed and the poll reports the finding as creating', () => {
    const description = describeAfterPress(
      { kind: 'failed', action: 'dismiss', failure: { kind: 'not-ok', status: 409 } },
      'creating',
    );

    expect(rowAction(description, 7)).toEqual({ kind: 'creating' });
  });

  it('should drop a failed row when the next poll reports the finding as ticketed', () => {
    const description = describeAfterPress(
      { kind: 'failed', action: 'create-ticket', failure: { kind: 'not-ok', status: 409 } },
      'ticketed',
    );

    expect(listedIds(description)).toEqual([3]);
  });

  it('should cut a created row like any other row and leave it out of the count when more than 20 are listed', () => {
    const description = describeKnownBugs(
      { findings: buildFindings(34), answeredAt },
      new Map([[2, { kind: 'created', ticketNumber: 212 }]]),
      projectId,
      false,
    );

    expect(listedIds(description)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(description).toMatchObject({ countLabel: '33', footer: 'Showing 20 of 34.' });
  });
});
