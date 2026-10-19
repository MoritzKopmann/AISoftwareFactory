export type UsageWindowDto = {
  readonly utilizationPercent: number;
  readonly resetsAt: string;
};

export type UsageStatusDto = {
  readonly pausedUntil: string | null;
  readonly observedAt: string | null;
  readonly fiveHour: UsageWindowDto | null;
  readonly sevenDay: UsageWindowDto | null;
};
