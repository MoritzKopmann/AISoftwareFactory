import { formatResetTime } from './format-reset-time.js';

export type UsageWindow = {
  readonly utilizationPercent: number;
  readonly resetsAt: string;
};

export type UsageWindowDescription =
  | { readonly noData: true }
  | {
      readonly noData: false;
      readonly tone: 'info' | 'warn' | 'danger';
      readonly utilizationPercent: number;
      readonly valueLabel: string;
      readonly resetLabel: string;
      readonly resetting: boolean;
    };

export function describeUsageWindow(window: UsageWindow | null, now: Date): UsageWindowDescription {
  if (window === null) return { noData: true };
  return {
    noData: false,
    tone: toneFor(window.utilizationPercent),
    utilizationPercent: window.utilizationPercent,
    valueLabel: `${window.utilizationPercent} %`,
    resetLabel: formatResetTime(window.resetsAt, now),
    resetting: new Date(window.resetsAt).getTime() <= now.getTime(),
  };
}

function toneFor(utilizationPercent: number): 'info' | 'warn' | 'danger' {
  if (utilizationPercent >= 100) return 'danger';
  if (utilizationPercent >= 80) return 'warn';
  return 'info';
}
