import { describe, expect, it } from 'vitest';
import { InMemoryWatchStore } from '../../../../../src/modules/tickets/infra/integrations/in-memory-watch-store.js';
import { RecordStatusWriteUseCase } from '../../../../../src/modules/tickets/logic/use-cases/record-status-write-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';

describe('RecordStatusWriteUseCase', () => {
  it('should store the write with the clock time when a write is recorded', () => {
    const watchStore = new InMemoryWatchStore();
    const now = '2026-09-28T12:00:00.000Z';

    new RecordStatusWriteUseCase({ watchStore, clock: new FakeClock(now) }).execute('octo/repo', {
      ticketNumber: 7,
      from: 'in-progress',
      to: 'ready',
      waiting: false,
      stuck: false,
    });

    expect(watchStore.statusWrites('octo/repo')).toEqual([
      {
        ticketNumber: 7,
        from: 'in-progress',
        to: 'ready',
        waiting: false,
        stuck: false,
        writtenAt: now,
      },
    ]);
  });
});
