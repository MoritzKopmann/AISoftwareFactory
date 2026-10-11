import { describeElapsedTime } from './describe-elapsed-time.js';

export function describeTimeAgo(isoTime: string, now: Date): string {
  const elapsedTime = describeElapsedTime(isoTime, now);
  return elapsedTime === 'just now' ? elapsedTime : `${elapsedTime} ago`;
}
