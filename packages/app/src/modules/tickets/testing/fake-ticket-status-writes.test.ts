import { describe, expect, it } from 'vitest';
import { FakeTicketStatusWrites } from './fake-ticket-status-writes.js';

describe('FakeTicketStatusWrites', () => {
  describe('readState', () => {
    it('should return the scripted types when the fake is scripted with types', async () => {
      const subject = new FakeTicketStatusWrites();
      subject.liveTypes = ['bug'];

      const state = await subject.readState();

      expect(state.types).toEqual(['bug']);
    });

    it('should return no types when the fake is not scripted with types', async () => {
      const subject = new FakeTicketStatusWrites();

      const state = await subject.readState();

      expect(state.types).toEqual([]);
    });
  });
});
