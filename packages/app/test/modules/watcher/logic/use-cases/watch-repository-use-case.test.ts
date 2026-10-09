import { describe, expect, it } from 'vitest';
import { InMemoryWatchStore } from '../../../../../src/modules/watcher/infra/integrations/in-memory-watch-store.js';
import { WatchRepositoryUseCase } from '../../../../../src/modules/watcher/logic/use-cases/watch-repository-use-case.js';

describe('WatchRepositoryUseCase', () => {
  it('should add a pending watch when the project has none', () => {
    const watchStore = new InMemoryWatchStore();

    new WatchRepositoryUseCase({ watchStore }).execute('octo/new', { owner: 'octo', name: 'new' });

    expect(watchStore.watch('octo/new')?.sync).toEqual({ state: 'pending' });
  });

  it('should keep the existing watch when the project is already watched', () => {
    const watchStore = new InMemoryWatchStore();
    const existing = {
      projectId: 'octo/repo',
      repository: { owner: 'octo', name: 'repo' },
      sync: { state: 'ok' as const, checkedAt: 'x', snapshotTakenAt: 'x' },
    };
    watchStore.saveWatch(existing);

    new WatchRepositoryUseCase({ watchStore }).execute('octo/repo', {
      owner: 'octo',
      name: 'repo',
    });

    expect(watchStore.watch('octo/repo')).toBe(existing);
  });
});
