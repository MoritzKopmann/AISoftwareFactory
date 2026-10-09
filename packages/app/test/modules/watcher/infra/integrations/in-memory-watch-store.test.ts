import { describe, expect, it } from 'vitest';
import { InMemoryWatchStore } from '../../../../../src/modules/watcher/infra/integrations/in-memory-watch-store.js';
import type { RepositoryWatch } from '../../../../../src/modules/watcher/logic/domain/types/repository-watch.js';
import type { StatusWrite } from '../../../../../src/modules/watcher/logic/domain/types/status-write.js';

const watch: RepositoryWatch = {
  projectId: 'octo/repo',
  repository: { owner: 'octo', name: 'repo' },
  sync: { state: 'pending' },
};
const write: StatusWrite = {
  ticketNumber: 7,
  from: 'stuck',
  to: 'ready',
  writtenAt: '2026-09-28T12:00:00.000Z',
};

describe('InMemoryWatchStore', () => {
  it('should return a saved watch when read by project id', () => {
    const store = new InMemoryWatchStore();
    store.saveWatch(watch);

    expect(store.watch('octo/repo')).toEqual(watch);
    expect(store.watches()).toEqual([watch]);
  });

  it('should return undefined when the project is unknown', () => {
    expect(new InMemoryWatchStore().watch('octo/none')).toBeUndefined();
  });

  it('should keep one status write per ticket when the same ticket is written twice', () => {
    const store = new InMemoryWatchStore();
    store.saveStatusWrite('octo/repo', write);
    store.saveStatusWrite('octo/repo', { ...write, to: 'in-progress' });

    expect(store.statusWrites('octo/repo')).toEqual([{ ...write, to: 'in-progress' }]);
  });

  it('should drop every status write when they are replaced by none', () => {
    const store = new InMemoryWatchStore();
    store.saveStatusWrite('octo/repo', write);
    store.replaceStatusWrites('octo/repo', []);

    expect(store.statusWrites('octo/repo')).toEqual([]);
  });
});
