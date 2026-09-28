import { describe, expect, it } from 'vitest';
import { deriveTicketStatus } from '../../../../../../src/modules/scheduler/logic/domain/functions/derive-ticket-status.js';

describe('deriveTicketStatus', () => {
  it('should return the status named by the single status label', () => {
    expect(deriveTicketStatus(['type: task', 'status: in-progress'], false)).toBe('in-progress');
  });

  it('should return idea when the ticket has no status label', () => {
    expect(deriveTicketStatus(['type: task'], false)).toBe('idea');
  });

  it('should return conflict when the ticket has more than one status label', () => {
    expect(deriveTicketStatus(['status: ready', 'status: stuck'], false)).toBe('conflict');
  });

  it('should return closed when the ticket is closed whatever its labels say', () => {
    expect(deriveTicketStatus(['status: in-review'], true)).toBe('closed');
  });

  it('should return conflict when the status label is not one aisf knows', () => {
    expect(deriveTicketStatus(['status: doing'], false)).toBe('conflict');
  });
});
