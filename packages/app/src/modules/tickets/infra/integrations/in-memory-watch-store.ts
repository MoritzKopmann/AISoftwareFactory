import type { RepositoryWatch } from '../../logic/domain/types/repository-watch.js';
import type { StatusWrite } from '../../logic/domain/types/status-write.js';
import type { WatchStore } from '../../logic/ports/watch-store.js';

export class InMemoryWatchStore implements WatchStore {
  private readonly watchesByProjectId = new Map<string, RepositoryWatch>();
  private readonly statusWritesByProjectId = new Map<string, Map<number, StatusWrite>>();

  watches(): ReadonlyArray<RepositoryWatch> {
    return [...this.watchesByProjectId.values()];
  }

  watch(projectId: string): RepositoryWatch | undefined {
    return this.watchesByProjectId.get(projectId);
  }

  saveWatch(watch: RepositoryWatch): void {
    this.watchesByProjectId.set(watch.projectId, watch);
  }

  statusWrites(projectId: string): ReadonlyArray<StatusWrite> {
    return [...(this.statusWritesByProjectId.get(projectId)?.values() ?? [])];
  }

  saveStatusWrite(projectId: string, write: StatusWrite): void {
    const writes = this.statusWritesByProjectId.get(projectId) ?? new Map<number, StatusWrite>();
    writes.set(write.ticketNumber, write);
    this.statusWritesByProjectId.set(projectId, writes);
  }

  replaceStatusWrites(projectId: string, writes: ReadonlyArray<StatusWrite>): void {
    if (writes.length === 0) {
      this.statusWritesByProjectId.delete(projectId);
      return;
    }
    this.statusWritesByProjectId.set(
      projectId,
      new Map(writes.map((write) => [write.ticketNumber, write])),
    );
  }
}
