import { describe, expect, it } from 'vitest';
import { rankDueTickets } from './rank-due-tickets.js';

describe('rankDueTickets', () => {
  it('should put ready tickets before plan tickets', () => {
    const ranked = rankDueTickets([
      { number: 11, status: 'plan', types: [], closingPullRequests: [] },
      { number: 12, status: 'ready', types: [], closingPullRequests: [] },
    ]);

    expect(ranked.map(({ number }) => number)).toEqual([12, 11]);
  });

  it('should drop tickets that are neither ready nor plan', () => {
    const ranked = rankDueTickets([
      { number: 10, status: 'backlog', types: [], closingPullRequests: [] },
      { number: 14, status: 'idea', types: [], closingPullRequests: [] },
      { number: 7, status: 'ready', types: [], closingPullRequests: [] },
    ]);

    expect(ranked.map(({ number }) => number)).toEqual([7]);
  });

  it('should put in-review tickets before ready and plan tickets', () => {
    const ranked = rankDueTickets([
      { number: 11, status: 'plan', types: [], closingPullRequests: [] },
      { number: 12, status: 'ready', types: [], closingPullRequests: [] },
      { number: 13, status: 'in-review', types: [], closingPullRequests: [] },
    ]);

    expect(ranked.map(({ number }) => number)).toEqual([13, 12, 11]);
  });
});
