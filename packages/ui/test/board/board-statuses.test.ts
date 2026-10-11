import { ticketStatusSchema } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { boardStatuses } from '../../src/board/board.js';

describe('boardStatuses', () => {
  it('should list the statuses in lifecycle order without a waiting or stuck row', () => {
    expect(boardStatuses).toEqual(ticketStatusSchema.options);
    expect(boardStatuses).not.toContain('waiting');
    expect(boardStatuses).not.toContain('stuck');
  });
});
