import { describe, expect, it, vi } from 'vitest';
import { subscribeToSnapshotChanged } from './subscribe-to-snapshot-changed.js';
import type { ReviewedTicket } from '../../business/domain/types/reviewed-ticket.js';
import { MergeService } from '../../business/service/merge-service.js';
import type { DomainEvents } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';
import {
  FakePullRequestMerges,
  FakeProjectLookup,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
} from '../../testing/fake-scheduler-ports.js';

const approvedTicket: ReviewedTicket = {
  number: 140,
  status: 'in-review',
  closingPullRequests: [
    {
      number: 201,
      state: 'OPEN',
      approved: true,
      checks: 'none',
      mergeable: 'mergeable',
      canBeRebased: true,
      headCommit: 'abc123',
    },
  ],
};

const snapshotChanged: DomainEvents['snapshot.changed'] = {
  projectId: 'moritz/aisf',
  addedTicketNumbers: [],
  changedTicketNumbers: [140],
  removedTicketNumbers: [],
};

function buildSubject() {
  const bus = new InMemoryEventBus<DomainEvents>();
  const pullRequestMerges = new FakePullRequestMerges();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const mergeService = new MergeService({
    pullRequestMerges,
    runner: new FakeRunnerPort(),
    reviewedTicketLookup: new FakeReviewedTicketLookup([approvedTicket]),
    projectLookup: new FakeProjectLookup(),
    logger,
  });
  const unsubscribe = subscribeToSnapshotChanged(bus, mergeService, logger);
  return { bus, pullRequestMerges, logger, unsubscribe };
}

describe('subscribeToSnapshotChanged', () => {
  it('should rebase-merge the approved pull request when snapshot.changed is emitted', async () => {
    const { bus, pullRequestMerges } = buildSubject();

    bus.emit('snapshot.changed', snapshotChanged);

    await vi.waitFor(() => expect(pullRequestMerges.calls).toEqual(['merge #201 abc123']));
  });

  it('should log the failure and not throw when merging fails unexpectedly', async () => {
    const { bus, pullRequestMerges, logger } = buildSubject();
    pullRequestMerges.mergeError = new Error('boom');

    expect(() => bus.emit('snapshot.changed', snapshotChanged)).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom')),
    );
  });

  it('should stop merging when the returned unsubscribe is called', async () => {
    const { bus, pullRequestMerges, unsubscribe } = buildSubject();

    unsubscribe();
    bus.emit('snapshot.changed', snapshotChanged);
    await Promise.resolve();

    expect(pullRequestMerges.calls).toEqual([]);
  });
});
