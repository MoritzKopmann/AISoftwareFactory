import type { Clock } from '../../../../shared/clock/clock.js';
import type { UsageReader } from '../port/sdk/usage-reader.js';
import type { UsageService } from './usage-service.js';

export type UsageRefreshServiceDependencies = {
  readonly usageService: Pick<UsageService, 'readObservedAt' | 'recordObservation'>;
  readonly usageReader: UsageReader;
  readonly clock: Clock;
};

const staleAfterMilliseconds = 5 * 60 * 1000;

export class UsageRefreshService {
  private lastAttemptAt: number | null = null;
  private isReading = false;

  constructor(private readonly dependencies: UsageRefreshServiceDependencies) {}

  /**
   * Reads usage when the stored data and the last attempt are both over 5 minutes old.
   * Returns whether stored values changed. Throws when the read fails.
   */
  async refreshIfStale(): Promise<boolean> {
    if (this.isReading) {
      return false;
    }
    this.isReading = true;
    try {
      return await this.refreshWhenDue();
    } finally {
      this.isReading = false;
    }
  }

  private async refreshWhenDue(): Promise<boolean> {
    const { usageService, usageReader, clock } = this.dependencies;
    const now = Date.parse(clock.now());
    if (this.hasAttemptedRecently(now)) {
      return false;
    }
    const observedAt = await usageService.readObservedAt();
    if (hasFreshData(observedAt, now)) {
      return false;
    }

    this.lastAttemptAt = now;
    const { fiveHour, sevenDay } = await usageReader.read();
    if (fiveHour === null && sevenDay === null) {
      return false;
    }
    return usageService.recordObservation({
      observedAt: clock.now(),
      fiveHour,
      sevenDay,
      refusedUntil: null,
    });
  }

  private hasAttemptedRecently(now: number): boolean {
    return this.lastAttemptAt !== null && !isStale(this.lastAttemptAt, now);
  }
}

function hasFreshData(observedAt: string | null, now: number): boolean {
  return observedAt !== null && !isStale(Date.parse(observedAt), now);
}

function isStale(since: number, now: number): boolean {
  return now - since > staleAfterMilliseconds;
}
