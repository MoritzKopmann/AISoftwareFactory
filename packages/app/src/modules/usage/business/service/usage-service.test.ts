import { beforeEach, describe, expect, it } from 'vitest';
import { UsageService } from './usage-service.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { InMemoryUsageRepository } from '../../testing/in-memory-usage-repository.js';
import type { WindowObservation } from '../domain/types/window-observation.js';

const fiveHour = { utilizationPercent: 42, resetsAt: '2026-10-18T15:00:00Z' };
const sevenDay = { utilizationPercent: 10, resetsAt: '2026-10-22T08:00:00Z' };

function observation(overrides: Partial<WindowObservation> = {}): WindowObservation {
  return {
    observedAt: '2026-10-18T12:00:00Z',
    fiveHour,
    sevenDay,
    refusedUntil: null,
    ...overrides,
  };
}

describe('UsageService', () => {
  let clock: FakeClock;
  let service: UsageService;

  beforeEach(() => {
    clock = new FakeClock('2026-10-18T12:00:00Z');
    service = new UsageService({ usageRepository: new InMemoryUsageRepository(), clock });
  });

  describe('recordObservation', () => {
    it('should store both windows and report a change when the first observation arrives', async () => {
      const changed = await service.recordObservation(observation());

      expect(changed).toBe(true);
      expect(await service.readStatus()).toEqual({
        pausedUntil: null,
        observedAt: '2026-10-18T12:00:00Z',
        fiveHour,
        sevenDay,
      });
    });

    it('should report no change when only observedAt is newer', async () => {
      await service.recordObservation(observation());

      const changed = await service.recordObservation(
        observation({ observedAt: '2026-10-18T12:05:00Z' }),
      );

      expect(changed).toBe(false);
      expect(await service.readObservedAt()).toBe('2026-10-18T12:05:00Z');
    });

    it('should keep the last known window when the observation has it as null', async () => {
      await service.recordObservation(observation());

      await service.recordObservation(
        observation({ fiveHour: { ...fiveHour, utilizationPercent: 50 }, sevenDay: null }),
      );

      const status = await service.readStatus();
      expect(status.fiveHour?.utilizationPercent).toBe(50);
      expect(status.sevenDay).toEqual(sevenDay);
    });

    it('should pause and report a change when a refusal arrives', async () => {
      const changed = await service.recordObservation(
        observation({ refusedUntil: '2026-10-18T15:00:00Z' }),
      );

      expect(changed).toBe(true);
      expect((await service.readStatus()).pausedUntil).toBe('2026-10-18T15:00:00Z');
    });

    it('should extend the pause when a later refusal arrives', async () => {
      await service.recordObservation(observation({ refusedUntil: '2026-10-18T15:00:00Z' }));

      const changed = await service.recordObservation(
        observation({ refusedUntil: '2026-10-18T16:00:00Z' }),
      );

      expect(changed).toBe(true);
      expect((await service.readStatus()).pausedUntil).toBe('2026-10-18T16:00:00Z');
    });

    it('should keep the pause and report no change when an earlier refusal arrives', async () => {
      await service.recordObservation(observation({ refusedUntil: '2026-10-18T15:00:00Z' }));

      const changed = await service.recordObservation(
        observation({ refusedUntil: '2026-10-18T14:00:00Z' }),
      );

      expect(changed).toBe(false);
      expect((await service.readStatus()).pausedUntil).toBe('2026-10-18T15:00:00Z');
    });

    it('should keep the pause when the observation has no refusal', async () => {
      await service.recordObservation(observation({ refusedUntil: '2026-10-18T15:00:00Z' }));

      await service.recordObservation(observation({ refusedUntil: null }));

      expect((await service.readStatus()).pausedUntil).toBe('2026-10-18T15:00:00Z');
    });
  });

  describe('readStatus', () => {
    it('should report no pause when the clock reaches the pause end', async () => {
      await service.recordObservation(observation({ refusedUntil: '2026-10-18T15:00:00Z' }));

      clock.setNow('2026-10-18T15:00:00Z');

      expect((await service.readStatus()).pausedUntil).toBeNull();
    });

    it('should return null in every field when nothing is stored', async () => {
      expect(await service.readStatus()).toEqual({
        pausedUntil: null,
        observedAt: null,
        fiveHour: null,
        sevenDay: null,
      });
      expect(await service.readObservedAt()).toBeNull();
    });
  });
});
