export type WindowUsage = {
  readonly utilizationPercent: number;
  readonly resetsAt: string;
};

export type UsageWindow = {
  readonly fiveHour: WindowUsage | null;
  readonly sevenDay: WindowUsage | null;
  readonly observedAt: string | null;
  readonly pausedUntil: string | null;
};
