import type { Clock } from '../../../../shared/clock/clock.js';
import type { StatusWrite } from '../domain/types/status-write.js';
import type { WatchStore } from '../ports/watch-store.js';

export type RecordStatusWriteDependencies = {
  readonly watchStore: WatchStore;
  readonly clock: Clock;
};

export class RecordStatusWriteUseCase {
  constructor(private readonly dependencies: RecordStatusWriteDependencies) {}

  execute(projectId: string, write: Omit<StatusWrite, 'writtenAt'>): void {
    const { watchStore, clock } = this.dependencies;
    watchStore.saveStatusWrite(projectId, { ...write, writtenAt: clock.now() });
  }
}
