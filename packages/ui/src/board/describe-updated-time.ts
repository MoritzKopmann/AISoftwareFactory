import { describeTimeAgo } from './describe-time-ago.js';

export function describeUpdatedTime(isoTime: string, now: Date): string {
  return `Updated ${describeTimeAgo(isoTime, now)}`;
}
