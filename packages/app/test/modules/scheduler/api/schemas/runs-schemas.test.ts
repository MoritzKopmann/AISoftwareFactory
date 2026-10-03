import { describe, expect, it } from 'vitest';
import {
  runEndingResponseSchema,
  ticketRunResponseSchema,
} from '../../../../../src/modules/scheduler/api/schemas/runs-schemas.js';

describe('runs-schemas', () => {
  describe('ticketRunResponseSchema', () => {
    it('should accept a checkpoint ending when it carries a request', () => {
      const parsed = ticketRunResponseSchema.parse({
        availability: { kind: 'available' },
        lastRun: {
          id: 'run-1',
          startedAt: '2026-01-01T00:00:00Z',
          endedAt: '2026-01-01T00:01:00Z',
          ending: { kind: 'checkpoint', request: 'Check the waiting chip' },
        },
      });

      expect(parsed.lastRun?.ending).toEqual({
        kind: 'checkpoint',
        request: 'Check the waiting chip',
      });
    });
  });

  describe('runEndingResponseSchema', () => {
    it('should reject a checkpoint ending when the request is missing', () => {
      expect(runEndingResponseSchema.safeParse({ kind: 'checkpoint' }).success).toBe(false);
    });
  });
});
