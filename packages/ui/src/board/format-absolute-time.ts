import { formatClockTime } from './format-clock-time.js';

const shortMonthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatAbsoluteTime(isoTime: string): string {
  const time = new Date(isoTime);
  const month = shortMonthNames[time.getMonth()];
  return `${time.getDate()} ${month} ${time.getFullYear()} ${formatClockTime(isoTime, 'minutes')}`;
}
