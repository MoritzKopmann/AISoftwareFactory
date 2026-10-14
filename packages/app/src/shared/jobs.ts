export type Job = () => Promise<void>;

/** Background jobs, keyed `<module>.<job-name>`. */
export type Jobs = Readonly<Record<string, Job>>;
