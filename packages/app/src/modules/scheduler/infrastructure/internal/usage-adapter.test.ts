import { describe, expect, it } from 'vitest';
import { FakeUsageApi } from '../../testing/fake-scheduler-apis.js';
import { UsageAdapter } from './usage-adapter.js';

describe('UsageAdapter', () => {
  describe('pausedUntil', () => {
    it('should return the paused-until time when usage is paused', async () => {
      const usage = new FakeUsageApi();
      usage.pausedUntil = '2026-10-18T15:00:00.000Z';

      expect(await new UsageAdapter(usage).pausedUntil()).toBe('2026-10-18T15:00:00.000Z');
    });

    it('should return undefined when usage is not paused', async () => {
      expect(await new UsageAdapter(new FakeUsageApi()).pausedUntil()).toBeUndefined();
    });
  });
});
