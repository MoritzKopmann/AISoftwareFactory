// Scheduled / command-style entry points a module contributes (cron, CLI). Keyed "<module>.<job-name>".
// The composition root merges them; main.ts (or a scheduler) runs them by name.
export type Job = () => Promise<void>;
export type Jobs = Record<string, Job>;
