import { describe, expect, it } from 'vitest';
import { deriveTicketTypes } from '../../../src/shared/ticket-type/derive-ticket-types.js';

describe('deriveTicketTypes', () => {
  it('should return the known type when other labels surround it', () => {
    expect(deriveTicketTypes(['status: ready', 'type: spike', 'priority: high'])).toEqual([
      'spike',
    ]);
  });

  it('should drop an unknown type label when a known one is present', () => {
    expect(deriveTicketTypes(['type: chore', 'type: bug'])).toEqual(['bug']);
  });

  it('should list a duplicated type label once when it appears twice', () => {
    expect(deriveTicketTypes(['type: spike', 'type: spike'])).toEqual(['spike']);
  });

  it('should return no types when no type label exists', () => {
    expect(deriveTicketTypes(['status: ready', 'hitl'])).toEqual([]);
  });
});
