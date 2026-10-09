import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import { failWatch } from '../domain/functions/fail-watch.js';
import type { WatchStore } from '../ports/watch-store.js';

export type FailWatchesDependencies = {
  readonly watchStore: WatchStore;
  readonly clock: Clock;
  readonly events: EventPublisher;
};

export class FailWatchesUseCase {
  constructor(private readonly dependencies: FailWatchesDependencies) {}

  execute(error: unknown): void {
    const { watchStore, clock, events } = this.dependencies;
    const failedAt = clock.now();
    const message = error instanceof Error ? error.message : String(error);
    for (const watch of watchStore.watches()) {
      watchStore.saveWatch(failWatch(watch, { cause: 'unexpected', message, failedAt }));
      events.emit('watch.updated', { projectId: watch.projectId });
    }
  }
}
