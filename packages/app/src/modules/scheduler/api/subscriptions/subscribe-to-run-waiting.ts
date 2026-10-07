import type { EventSubscriber } from '../../../../shared/bus/event-subscriber.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { SettleWaitingRunUseCase } from '../../logic/use-cases/settle-waiting-run-use-case.js';

export function subscribeToRunWaiting(
  subscriber: EventSubscriber,
  settleWaitingRun: SettleWaitingRunUseCase,
  logger: Logger,
): () => void {
  return subscriber.on('run.waiting', (waitingRun) => {
    // A bus handler must never reject: an unhandled rejection would end the process. A failed
    // write is not retried: the fallback ending writes the status later.
    settleWaitingRun.execute(waitingRun).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Marking run ${waitingRun.runId} waiting failed: ${message}`);
    });
  });
}
