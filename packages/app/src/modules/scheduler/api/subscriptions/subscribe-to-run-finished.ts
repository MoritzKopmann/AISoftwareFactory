import type { EventSubscriber } from '../../../../shared/bus/event-subscriber.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { SettleFinishedRunUseCase } from '../../logic/use-cases/settle-finished-run-use-case.js';

export function subscribeToRunFinished(
  subscriber: EventSubscriber,
  settleFinishedRun: SettleFinishedRunUseCase,
  logger: Logger,
): () => void {
  return subscriber.on('run.finished', (finishedRun) => {
    // A bus handler must never reject: an unhandled rejection would end the process. An
    // unsettled run is replayed at the next start.
    settleFinishedRun.execute(finishedRun).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Settling run ${finishedRun.runId} failed: ${message}`);
    });
  });
}
