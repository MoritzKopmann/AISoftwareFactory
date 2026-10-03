import { describe, expect, it } from 'vitest';
import { deriveTicketStatus } from '../../../src/shared/ticket-status/derive-ticket-status.js';

describe('deriveTicketStatus', () => {
  it('should be idea when an open issue has no status label', () => {
    expect(deriveTicketStatus({ state: 'open', labelNames: ['type: bug'] })).toEqual({
      status: 'idea',
      conflictingStatuses: [],
    });
  });

  it('should be closed when the issue is closed, whatever its labels', () => {
    expect(
      deriveTicketStatus({ state: 'closed', labelNames: ['status: ready', 'status: stuck'] }),
    ).toEqual({ status: 'closed', conflictingStatuses: [] });
  });

  it('should read the status from the label when an open issue has one known status', () => {
    expect(deriveTicketStatus({ state: 'open', labelNames: ['status: in-review'] })).toEqual({
      status: 'in-review',
      conflictingStatuses: [],
    });
  });

  it('should be idea when the only status label is unknown', () => {
    expect(deriveTicketStatus({ state: 'open', labelNames: ['status: foo'] })).toEqual({
      status: 'idea',
      conflictingStatuses: [],
    });
  });

  it('should ignore an unknown status label when a known one is present', () => {
    expect(
      deriveTicketStatus({ state: 'open', labelNames: ['status: foo', 'status: ready'] }),
    ).toEqual({ status: 'ready', conflictingStatuses: [] });
  });

  it('should be conflict naming both statuses when two known status labels are present', () => {
    expect(
      deriveTicketStatus({ state: 'open', labelNames: ['status: ready', 'status: in-review'] }),
    ).toEqual({ status: 'conflict', conflictingStatuses: ['ready', 'in-review'] });
  });

  it('should be waiting with no conflict when the only status label is status: waiting', () => {
    expect(deriveTicketStatus({ state: 'open', labelNames: ['status: waiting'] })).toEqual({
      status: 'waiting',
      conflictingStatuses: [],
    });
  });

  it('should be conflict naming in-progress and waiting when both labels are present', () => {
    expect(
      deriveTicketStatus({
        state: 'open',
        labelNames: ['status: in-progress', 'status: waiting'],
      }),
    ).toEqual({ status: 'conflict', conflictingStatuses: ['in-progress', 'waiting'] });
  });
});
