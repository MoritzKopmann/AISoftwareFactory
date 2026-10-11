import type { RateLimitGate } from '../types/rate-limit-gate.js';
import type { RepositoryWatch } from '../types/repository-watch.js';

export function findRateLimitGate(
  watches: ReadonlyArray<RepositoryWatch>,
  now: string,
): RateLimitGate | undefined {
  const nowMilliseconds = Date.parse(now);
  let gate: RateLimitGate | undefined;
  for (const { sync } of watches) {
    if (
      sync.state === 'failed' &&
      sync.cause === 'rate-limited' &&
      sync.retryAt !== undefined &&
      Date.parse(sync.retryAt) > nowMilliseconds &&
      (gate === undefined || Date.parse(sync.retryAt) > Date.parse(gate.retryAt))
    ) {
      gate = { retryAt: sync.retryAt, message: sync.message };
    }
  }
  return gate;
}
