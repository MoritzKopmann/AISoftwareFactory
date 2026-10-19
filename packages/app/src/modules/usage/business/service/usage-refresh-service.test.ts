import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeUsageReader } from '../../testing/fake-usage-reader.js';
import { InMemoryUsageRepository } from '../../testing/in-memory-usage-repository.js';
import { UsageReadFailedError } from '../errors/usage-read-failed-error.js';
import type { UsageReading } from '../port/sdk/usage-reader.js';
import { UsageRefreshService } from './usage-refresh-service.js';
import { UsageService } from './usage-service.js';

const reading: UsageReading = {
  fiveHour: { utilizationPercent: 55, resetsAt: '2026-10-18T17:00:00.000Z' },
  sevenDay: null,
};

function createSubject(now: string, storedObservedAt: string | null = null) {
  const clock = new FakeClock(now);
  const usageRepository = new InMemoryUsageRepository();
  const usageService = new UsageService({ usageRepository, clock });
  const reader = new FakeUsageReader();
  const refresh = new UsageRefreshService({ usageService, usageReader: reader, clock });
  const seeded =
    storedObservedAt === null
      ? Promise.resolve(false)
      : usageService.recordObservation({
          observedAt: storedObservedAt,
          fiveHour: { utilizationPercent: 42, resetsAt: '2026-10-18T16:00:00.000Z' },
          sevenDay: null,
          refusedUntil: null,
        });
  return { clock, usageService, reader, refresh, seeded };
}

describe('UsageRefreshService', () => {
  describe('refreshIfStale', () => {
    it('should read and store with the clock time when the newest data is over 5 minutes old', async () => {
      const { reader, refresh, usageService, seeded } = createSubject(
        '2026-10-18T12:05:01.000Z',
        '2026-10-18T12:00:00.000Z',
      );
      await seeded;
      reader.returns(reading);

      const changed = await refresh.refreshIfStale();

      expect(reader.reads).toBe(1);
      expect(changed).toBe(true);
      expect((await usageService.readStatus()).observedAt).toBe('2026-10-18T12:05:01.000Z');
    });

    it('should not read when the newest data is exactly 5 minutes old', async () => {
      const { reader, refresh, seeded } = createSubject(
        '2026-10-18T12:05:00.000Z',
        '2026-10-18T12:00:00.000Z',
      );
      await seeded;

      await refresh.refreshIfStale();

      expect(reader.reads).toBe(0);
    });

    it('should read when the store is empty', async () => {
      const { reader, refresh } = createSubject('2026-10-18T12:00:00.000Z');

      await refresh.refreshIfStale();

      expect(reader.reads).toBe(1);
    });

    it('should read only once when a second call comes while a read runs', async () => {
      const { reader, refresh } = createSubject('2026-10-18T12:00:00.000Z');
      const release = reader.hangs();

      const first = refresh.refreshIfStale();
      const second = await refresh.refreshIfStale();
      release(reading);
      await first;

      expect(second).toBe(false);
      expect(reader.reads).toBe(1);
    });

    it('should report a change when the read value differs from the stored one', async () => {
      const { reader, refresh, usageService, seeded } = createSubject(
        '2026-10-18T12:10:00.000Z',
        '2026-10-18T12:00:00.000Z',
      );
      await seeded;
      reader.returns(reading);

      const changed = await refresh.refreshIfStale();

      expect(changed).toBe(true);
      expect((await usageService.readStatus()).fiveHour?.utilizationPercent).toBe(55);
    });

    it('should never pause when the read window is at 100 %', async () => {
      const { reader, refresh, usageService, seeded } = createSubject(
        '2026-10-18T12:10:00.000Z',
        '2026-10-18T12:00:00.000Z',
      );
      await seeded;
      reader.returns({
        fiveHour: { utilizationPercent: 100, resetsAt: '2026-10-18T17:00:00.000Z' },
        sevenDay: null,
      });

      await refresh.refreshIfStale();

      expect((await usageService.readStatus()).pausedUntil).toBeNull();
    });

    it('should keep a stored pause when a refresh reads new windows', async () => {
      const { reader, refresh, usageService } = createSubject('2026-10-18T12:10:00.000Z');
      await usageService.recordObservation({
        observedAt: '2026-10-18T12:00:00.000Z',
        fiveHour: null,
        sevenDay: null,
        refusedUntil: '2026-10-18T15:00:00.000Z',
      });
      reader.returns(reading);

      await refresh.refreshIfStale();

      expect((await usageService.readStatus()).pausedUntil).toBe('2026-10-18T15:00:00.000Z');
    });

    it('should wait 5 minutes after a failed read', async () => {
      const { clock, reader, refresh, usageService } = createSubject('2026-10-18T12:00:00.000Z');
      reader.fails(new UsageReadFailedError('boom'));

      await expect(refresh.refreshIfStale()).rejects.toBeInstanceOf(UsageReadFailedError);
      clock.setNow('2026-10-18T12:00:30.000Z');
      await expect(refresh.refreshIfStale()).resolves.toBe(false);
      clock.setNow('2026-10-18T12:05:01.000Z');
      await expect(refresh.refreshIfStale()).rejects.toBeInstanceOf(UsageReadFailedError);

      expect(reader.reads).toBe(2);
      expect((await usageService.readStatus()).observedAt).toBeNull();
    });

    it('should store nothing and wait 5 minutes when both windows are null', async () => {
      const { clock, reader, refresh, usageService } = createSubject('2026-10-18T12:00:00.000Z');

      const first = await refresh.refreshIfStale();
      clock.setNow('2026-10-18T12:00:30.000Z');
      await refresh.refreshIfStale();

      expect(first).toBe(false);
      expect(reader.reads).toBe(1);
      expect(await usageService.readStatus()).toEqual({
        fiveHour: null,
        sevenDay: null,
        observedAt: null,
        pausedUntil: null,
      });
    });

    it('should read again when the in-flight read has failed', async () => {
      const { clock, reader, refresh } = createSubject('2026-10-18T12:00:00.000Z');
      reader.fails(new UsageReadFailedError('boom'));
      await refresh.refreshIfStale().catch(() => {});
      clock.setNow('2026-10-18T12:06:00.000Z');
      reader.returns(reading);

      await refresh.refreshIfStale();

      expect(reader.reads).toBe(2);
    });
  });
});
