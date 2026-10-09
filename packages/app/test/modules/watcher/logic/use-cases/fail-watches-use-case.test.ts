import { describe, expect, it } from 'vitest';
import { InMemoryWatchStore } from '../../../../../src/modules/watcher/infra/integrations/in-memory-watch-store.js';
import { FailWatchesUseCase } from '../../../../../src/modules/watcher/logic/use-cases/fail-watches-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';

const now = '2026-09-28T12:00:00.000Z';

describe('FailWatchesUseCase', () => {
  it('should fail and announce every watch when a poll fails unexpectedly', () => {
    const watchStore = new InMemoryWatchStore();
    const events = new FakeEventPublisher();
    for (const projectId of ['octo/one', 'octo/two']) {
      const [owner = '', name = ''] = projectId.split('/');
      watchStore.saveWatch({ projectId, repository: { owner, name }, sync: { state: 'pending' } });
    }

    new FailWatchesUseCase({ watchStore, clock: new FakeClock(now), events }).execute(
      new Error('boom'),
    );

    expect(watchStore.watches().map((watch) => watch.sync)).toEqual([
      expect.objectContaining({ state: 'failed', cause: 'unexpected', message: 'boom' }),
      expect.objectContaining({ state: 'failed', cause: 'unexpected', message: 'boom' }),
    ]);
    expect(events.emittedEvents).toEqual([
      { name: 'watch.updated', payload: { projectId: 'octo/one' } },
      { name: 'watch.updated', payload: { projectId: 'octo/two' } },
    ]);
  });
});
