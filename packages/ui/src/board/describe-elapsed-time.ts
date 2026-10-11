const millisecondsPerMinute = 60_000;
const minutesPerHour = 60;

export function describeElapsedTime(isoTime: string, now: Date): string {
  const ageInMinutes = Math.floor((now.getTime() - Date.parse(isoTime)) / millisecondsPerMinute);
  if (ageInMinutes < 1) {
    return 'just now';
  }
  if (ageInMinutes < minutesPerHour) {
    return `${ageInMinutes} min`;
  }
  return `${Math.floor(ageInMinutes / minutesPerHour)} h`;
}
