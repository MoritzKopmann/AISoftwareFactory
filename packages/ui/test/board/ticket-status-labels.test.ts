import { describe, expect, it } from 'vitest';
import { ticketStatusLabel } from '../../src/board/ticket-status-labels.js';

describe('ticketStatusLabel', () => {
  it('should return a capitalised name when the status is a single word', () => {
    expect(ticketStatusLabel('idea')).toBe('Idea');
    expect(ticketStatusLabel('closed')).toBe('Closed');
  });

  it('should return spaced words when the status is hyphenated', () => {
    expect(ticketStatusLabel('in-progress')).toBe('In progress');
    expect(ticketStatusLabel('in-review')).toBe('In review');
  });
});
