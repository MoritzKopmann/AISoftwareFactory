import { describe, expect, it } from 'vitest';
import { rankDueTickets } from './rank-due-tickets.js';

describe('rankDueTickets', () => {
  it('should put ready tickets before plan tickets', () => {
    const ranked = rankDueTickets([
      { number: 11, status: 'plan', closingPullRequests: [] },
      { number: 12, status: 'ready', closingPullRequests: [] },
    ]);

    expect(ranked.map(({ number }) => number)).toEqual([12, 11]);
  });

  it('should drop tickets that are neither ready nor plan', () => {
    const ranked = rankDueTickets([
      { number: 10, status: 'backlog', closingPullRequests: [] },
      { number: 14, status: 'idea', closingPullRequests: [] },
      { number: 7, status: 'ready', closingPullRequests: [] },
    ]);

    expect(ranked.map(({ number }) => number)).toEqual([7]);
  });
});
