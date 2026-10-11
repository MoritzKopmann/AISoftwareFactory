import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { StatusWrite } from '../domain/types/status-write.js';

export interface WatchStore {
  watches(): ReadonlyArray<RepositoryWatch>;
  watch(projectId: string): RepositoryWatch | undefined;
  saveWatch(watch: RepositoryWatch): void;
  statusWrites(projectId: string): ReadonlyArray<StatusWrite>;
  saveStatusWrite(projectId: string, write: StatusWrite): void;
  replaceStatusWrites(projectId: string, writes: ReadonlyArray<StatusWrite>): void;
}
