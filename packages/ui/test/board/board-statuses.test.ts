import { ticketStatusSchema } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { boardStatuses } from '../../src/board/board.js';

describe('boardStatuses', () => {
  it('should list the statuses in lifecycle order with waiting between in-progress and in-review', () => {
    expect(boardStatuses).toEqual(ticketStatusSchema.options);
    expect(boardStatuses.indexOf('waiting')).toBe(boardStatuses.indexOf('in-progress') + 1);
    expect(boardStatuses.indexOf('in-review')).toBe(boardStatuses.indexOf('waiting') + 1);
  });
});
