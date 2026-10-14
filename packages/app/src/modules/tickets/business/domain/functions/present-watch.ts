import type { RepositoryWatch } from '../types/repository-watch.js';
import type { StatusWrite } from '../types/status-write.js';
import { presentSnapshot } from './present-snapshot.js';

export function presentWatch(
  watch: RepositoryWatch,
  statusWrites: ReadonlyArray<StatusWrite>,
): RepositoryWatch {
  return watch.snapshot === undefined
    ? watch
    : { ...watch, snapshot: presentSnapshot(watch.snapshot, statusWrites) };
}
