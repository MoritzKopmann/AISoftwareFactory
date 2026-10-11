const millisecondsPerMinute = 60_000;

export function countRunMinutes(run: { readonly startedAt: string; readonly endedAt: string }) {
  return Math.floor((Date.parse(run.endedAt) - Date.parse(run.startedAt)) / millisecondsPerMinute);
}
