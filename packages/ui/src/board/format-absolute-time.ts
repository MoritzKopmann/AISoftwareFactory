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

function padToTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatAbsoluteTime(isoTime: string): string {
  const time = new Date(isoTime);
  const month = shortMonthNames[time.getMonth()];
  const clock = `${padToTwoDigits(time.getHours())}:${padToTwoDigits(time.getMinutes())}`;
  return `${time.getDate()} ${month} ${time.getFullYear()} ${clock}`;
}
