import type { WindowUsage } from './usage-window.js';

export type WindowObservation = {
  readonly observedAt: string;
  readonly fiveHour: WindowUsage | null;
  readonly sevenDay: WindowUsage | null;
  readonly refusedUntil: string | null;
};
