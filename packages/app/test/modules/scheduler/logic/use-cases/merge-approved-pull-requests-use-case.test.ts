import { describe, expect, it, vi } from 'vitest';
import type { ClosingPullRequest } from '../../../../../src/modules/scheduler/logic/domain/types/closing-pull-request.js';
import type { ReviewedTicket } from '../../../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';
import { PullRequestMergeFailedError } from '../../../../../src/modules/scheduler/logic/errors/pull-request-merge-failed-error.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { MergeApprovedPullRequestsUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/merge-approved-pull-requests-use-case.js';
import {
  FakePullRequestMerges,
  FakeProjectLookup,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
} from '../../fakes/fake-scheduler-ports.js';

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
  const useCase = new MergeApprovedPullRequestsUseCase({
    pullRequestMerges,
    runner,
    reviewedTicketLookup: new FakeReviewedTicketLookup(tickets),
    projectLookup,
    logger,
  });
  return { useCase, pullRequestMerges, runner, logger };
}

describe('MergeApprovedPullRequestsUseCase', () => {
  it('should rebase-merge the pull request pinned to its head commit when it is approved, green and rebaseable', async () => {
    const { useCase, pullRequestMerges } = buildSubject();

    await useCase.execute('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual(['merge #201 abc123']);
  });

  it('should merge nothing when the pull request is not approved', async () => {
    const notApproved: ReviewedTicket = {
      ...approvedTicket,
      closingPullRequests: [{ ...approvedPullRequest, approved: false }],
    };
    const { useCase, pullRequestMerges } = buildSubject([notApproved]);

    await useCase.execute('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual([]);
  });

  it('should merge nothing when the ticket has an active run', async () => {
    const { useCase, pullRequestMerges, runner } = buildSubject();
    runner.activeTicketNumber = 140;

    await useCase.execute('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual([]);
  });

  it('should merge nothing when the project is unknown', async () => {
    const unknownProject: ProjectLookup = { find: async () => undefined };
    const { useCase, pullRequestMerges } = buildSubject([approvedTicket], unknownProject);

    await useCase.execute('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual([]);
  });

  it('should merge the pull request once when a second snapshot arrives during the merge', async () => {
    const { useCase, pullRequestMerges } = buildSubject();
    let finishMerge: () => void = () => undefined;
    pullRequestMerges.mergeGate = new Promise((resolve) => {
      finishMerge = resolve;
    });

    const firstExecution = useCase.execute('moritz/aisf');
    await useCase.execute('moritz/aisf');
    finishMerge();
    await firstExecution;

    expect(pullRequestMerges.calls).toEqual(['merge #201 abc123']);
  });

  it('should merge the pull request again when an earlier merge attempt failed', async () => {
    const { useCase, pullRequestMerges, logger } = buildSubject();
    pullRequestMerges.mergeError = new PullRequestMergeFailedError('head moved');

    await useCase.execute('moritz/aisf');
    pullRequestMerges.mergeError = undefined;
    await useCase.execute('moritz/aisf');

    expect(pullRequestMerges.calls).toEqual(['merge #201 abc123', 'merge #201 abc123']);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('head moved'));
  });
});
