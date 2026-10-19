import { formatClockTime } from '../board/format-clock-time.js';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatResetTime(isoTime: string, now: Date): string {
  const resetsAt = new Date(isoTime);
  const clock = formatClockTime(isoTime, 'minutes');
  if (resetsAt.toDateString() === now.toDateString()) return clock;
  return `${weekdays[resetsAt.getDay()]} ${clock}`;
}
