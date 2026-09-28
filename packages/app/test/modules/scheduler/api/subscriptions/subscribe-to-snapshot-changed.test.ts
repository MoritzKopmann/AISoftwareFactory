import { describe, expect, it, vi } from 'vitest';
import { subscribeToSnapshotChanged } from '../../../../../src/modules/scheduler/api/subscriptions/subscribe-to-snapshot-changed.js';
import type { ReviewedTicket } from '../../../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';
import { MergeApprovedPullRequestsUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/merge-approved-pull-requests-use-case.js';
import type { AisfEventMap } from '../../../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../../../src/shared/bus/typed-event-bus.js';
import {
  FakeGitHubWrites,
  FakeProjectLookup,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
} from '../../fakes/fake-scheduler-ports.js';

const approvedTicket: ReviewedTicket = {
  number: 140,
  status: 'in-review',
  closingPullRequests: [
    {
      number: 201,
      state: 'OPEN',
      reviewDecision: 'APPROVED',
      checks: 'none',
      mergeable: 'mergeable',
      canBeRebased: true,
      headCommit: 'abc123',
    },
  ],
};

const snapshotChanged: AisfEventMap['snapshot.changed'] = {
  projectId: 'moritz/aisf',
  addedTicketNumbers: [],
  changedTicketNumbers: [140],
  removedTicketNumbers: [],
};

function buildSubject() {
  const bus = new TypedEventBus<AisfEventMap>();
  const gitHubWrites = new FakeGitHubWrites();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const mergeApprovedPullRequests = new MergeApprovedPullRequestsUseCase({
    gitHubWrites,
    runner: new FakeRunnerPort(),
    reviewedTicketLookup: new FakeReviewedTicketLookup([approvedTicket]),
    projectLookup: new FakeProjectLookup(),
    logger,
  });
  const unsubscribe = subscribeToSnapshotChanged(bus, mergeApprovedPullRequests, logger);
  return { bus, gitHubWrites, logger, unsubscribe };
}

describe('subscribeToSnapshotChanged', () => {
  it('should rebase-merge the approved pull request when snapshot.changed is emitted', async () => {
    const { bus, gitHubWrites } = buildSubject();

    bus.emit('snapshot.changed', snapshotChanged);

    await vi.waitFor(() => expect(gitHubWrites.calls).toEqual(['rebaseMerge #201 abc123']));
  });

  it('should log the failure and not throw when merging fails unexpectedly', async () => {
    const { bus, gitHubWrites, logger } = buildSubject();
    gitHubWrites.mergeError = new Error('boom');

    expect(() => bus.emit('snapshot.changed', snapshotChanged)).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom')),
    );
  });

  it('should stop merging when the returned unsubscribe is called', async () => {
    const { bus, gitHubWrites, unsubscribe } = buildSubject();

    unsubscribe();
    bus.emit('snapshot.changed', snapshotChanged);
    await Promise.resolve();

    expect(gitHubWrites.calls).toEqual([]);
  });
});
