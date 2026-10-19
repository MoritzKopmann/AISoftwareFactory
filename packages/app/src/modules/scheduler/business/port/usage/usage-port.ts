export interface UsagePort {
  /** The time all work is paused until, `undefined` when it is not paused. */
  pausedUntil(): Promise<string | undefined>;
}
