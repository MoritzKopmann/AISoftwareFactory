import type { Clock } from '../../../../shared/clock/clock.js';
import type { UsageWindow, WindowUsage } from '../domain/types/usage-window.js';
import type { WindowObservation } from '../domain/types/window-observation.js';
import type { UsageRepository } from '../port/repository/usage-repository.js';

export type UsageServiceDependencies = {
  readonly usageRepository: UsageRepository;
  readonly clock: Clock;
};

const emptyWindow: UsageWindow = {
  fiveHour: null,
  sevenDay: null,
  observedAt: null,
  pausedUntil: null,
};

export class UsageService {
  constructor(private readonly dependencies: UsageServiceDependencies) {}

  /** Stores the observation. Returns whether a window or the pause end changed. */
  async recordObservation(observation: WindowObservation): Promise<boolean> {
    const stored = (await this.dependencies.usageRepository.find()) ?? emptyWindow;
    const merged: UsageWindow = {
      fiveHour: observation.fiveHour ?? stored.fiveHour,
      sevenDay: observation.sevenDay ?? stored.sevenDay,
      observedAt: observation.observedAt,
      pausedUntil: laterOf(stored.pausedUntil, observation.refusedUntil),
    };

    await this.dependencies.usageRepository.save(merged);

    return (
      !sameUsage(stored.fiveHour, merged.fiveHour) ||
      !sameUsage(stored.sevenDay, merged.sevenDay) ||
      stored.pausedUntil !== merged.pausedUntil
    );
  }

  async readStatus(): Promise<UsageWindow> {
    const stored = (await this.dependencies.usageRepository.find()) ?? emptyWindow;
    const paused =
      stored.pausedUntil !== null &&
      Date.parse(stored.pausedUntil) > Date.parse(this.dependencies.clock.now());

    return { ...stored, pausedUntil: paused ? stored.pausedUntil : null };
  }

  async readObservedAt(): Promise<string | null> {
    return (await this.dependencies.usageRepository.find())?.observedAt ?? null;
  }
}

function sameUsage(left: WindowUsage | null, right: WindowUsage | null): boolean {
  return (
    left?.utilizationPercent === right?.utilizationPercent && left?.resetsAt === right?.resetsAt
  );
}

function laterOf(stored: string | null, refusedUntil: string | null): string | null {
  if (refusedUntil === null) {
    return stored;
  }
  if (stored === null) {
    return refusedUntil;
  }
  return Date.parse(refusedUntil) > Date.parse(stored) ? refusedUntil : stored;
}
