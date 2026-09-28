const millisecondsPerMinute = 60_000;
const minutesPerHour = 60;

export function describeUpdatedTime(isoTime: string, now: Date): string {
  const ageInMinutes = Math.floor((now.getTime() - Date.parse(isoTime)) / millisecondsPerMinute);
  if (ageInMinutes < 1) {
    return 'Updated just now';
  }
  if (ageInMinutes < minutesPerHour) {
    return `Updated ${ageInMinutes} min ago`;
  }
  return `Updated ${Math.floor(ageInMinutes / minutesPerHour)} h ago`;
}
