function padToTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatClockTime(isoTime: string, precision: 'minutes' | 'seconds'): string {
  const time = new Date(isoTime);
  const minutes = `${padToTwoDigits(time.getHours())}:${padToTwoDigits(time.getMinutes())}`;
  return precision === 'minutes' ? minutes : `${minutes}:${padToTwoDigits(time.getSeconds())}`;
}
