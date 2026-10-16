import { describe, expect, it, vi } from 'vitest';
import type { ClosingPullRequest } from '../../business/domain/types/closing-pull-request.js';
import type { ReviewedTicket } from '../../business/domain/types/reviewed-ticket.js';
import { PullRequestMergeFailedError } from '../../business/errors/pull-request-merge-failed-error.js';
import type { ProjectLookup } from '../port/project/project-lookup.js';
import { MergeService } from './merge-service.js';
import {
  FakePullRequestMerges,
  FakeProjectLookup,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
} from '../../testing/fake-scheduler-ports.js';

const approvedPullRequest: ClosingPullRequest = {
  number: 201,
  state: 'OPEN',
  approved: true,
  checks: 'passing',
  mergeable: 'mergeable',
  canBeRebased: true,
  headCommit: 'abc123',
};

const approvedTicket: ReviewedTicket = {
  number: 140,
  status: 'in-review',
  closingPullRequests: [approvedPullRequest],
};

function buildSubject(
  tickets: ReadonlyArray<ReviewedTicket> = [approvedTicket],
  projectLookup: ProjectLookup = new FakeProjectLookup(),
) {
  const pullRequestMerges = new FakePullRequestMerges();
  const runner = new FakeRunnerPort();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const service = new MergeService({
    pullRequestMerges,
    runner,
    reviewedTicketLookup: new FakeReviewedTicketLookup(tickets),
    projectLookup,
    logger,
  });
  return { service, pullRequestMerges, runner, logger };
}

describe('MergeService', () => {
  it('should rebase-merge the pull request pinned to its head commit when it is approved, green and rebaseable', async () => {
    const { service, pullRequestMerges } = buildSubject();

    await service.mergeApproved('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual(['merge #201 abc123']);
  });

  it('should merge nothing when the pull request is not approved', async () => {
    const notApproved: ReviewedTicket = {
      ...approvedTicket,
      closingPullRequests: [{ ...approvedPullRequest, approved: false }],
    };
    const { service, pullRequestMerges } = buildSubject([notApproved]);

    await service.mergeApproved('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual([]);
  });

  it('should merge nothing when the ticket has an active run', async () => {
    const { service, pullRequestMerges, runner } = buildSubject();
    runner.activeTicketNumbers = [140];

    await service.mergeApproved('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual([]);
  });

  it('should merge nothing when the project is unknown', async () => {
    const unknownProject: ProjectLookup = { find: async () => undefined };
    const { service, pullRequestMerges } = buildSubject([approvedTicket], unknownProject);

    await service.mergeApproved('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual([]);
  });

  it('should merge the pull request once when a second snapshot arrives during the merge', async () => {
    const { service, pullRequestMerges } = buildSubject();
    let finishMerge: () => void = () => undefined;
    pullRequestMerges.mergeGate = new Promise<void>((resolve) => {
      finishMerge = resolve;
    });

    const firstExecution = service.mergeApproved('moritz/aisf');
    await service.mergeApproved('moritz/aisf');
    finishMerge();
    await firstExecution;

    expect(pullRequestMerges.calls).toEqual(['merge #201 abc123']);
  });

  it('should merge the pull request again when an earlier merge attempt failed', async () => {
    const { service, pullRequestMerges, logger } = buildSubject();
    pullRequestMerges.mergeError = new PullRequestMergeFailedError('head moved');

    await service.mergeApproved('moritz/aisf');
    pullRequestMerges.mergeError = undefined;
    await service.mergeApproved('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual(['merge #201 abc123', 'merge #201 abc123']);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('head moved'));
  });
});
