import type { RepositoryWatch } from '../types/repository-watch.js';
import type { WatchFailure } from '../types/watch-failure.js';

export function failWatch(watch: RepositoryWatch, failure: WatchFailure): RepositoryWatch {
  return {
    ...watch,
    sync: {
      state: 'failed',
      ...failure,
      ...(watch.snapshot === undefined ? {} : { snapshotTakenAt: watch.snapshot.takenAt }),
    },
  };
}
