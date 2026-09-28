import { describe, expect, it, vi } from 'vitest';
import type { ClosingPullRequest } from '../../../../../src/modules/scheduler/logic/domain/types/closing-pull-request.js';
import type { ReviewedTicket } from '../../../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';
import { GitHubWriteFailedError } from '../../../../../src/modules/scheduler/logic/errors/github-write-failed-error.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { MergeApprovedPullRequestsUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/merge-approved-pull-requests-use-case.js';
import {
  FakeGitHubWrites,
  FakeProjectLookup,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
} from '../../fakes/fake-scheduler-ports.js';

const approvedPullRequest: ClosingPullRequest = {
  number: 201,
  state: 'OPEN',
  reviewDecision: 'APPROVED',
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
  const gitHubWrites = new FakeGitHubWrites();
  const runner = new FakeRunnerPort();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const useCase = new MergeApprovedPullRequestsUseCase({
    gitHubWrites,
    runner,
    reviewedTicketLookup: new FakeReviewedTicketLookup(tickets),
    projectLookup,
    logger,
  });
  return { useCase, gitHubWrites, runner, logger };
}

describe('MergeApprovedPullRequestsUseCase', () => {
  it('should rebase-merge the pull request pinned to its head commit when it is approved, green and rebaseable', async () => {
    const { useCase, gitHubWrites } = buildSubject();

    await useCase.execute('moritz/aisf');

    expect(gitHubWrites.calls).toEqual(['rebaseMerge #201 abc123']);
  });

  it('should merge nothing when the pull request is not approved', async () => {
    const awaitingReview: ReviewedTicket = {
      ...approvedTicket,
      closingPullRequests: [{ ...approvedPullRequest, reviewDecision: 'REVIEW_REQUIRED' }],
    };
    const { useCase, gitHubWrites } = buildSubject([awaitingReview]);

    await useCase.execute('moritz/aisf');

    expect(gitHubWrites.calls).toEqual([]);
  });

  it('should merge nothing when the ticket has an active run', async () => {
    const { useCase, gitHubWrites, runner } = buildSubject();
    runner.activeTicketNumber = 140;

    await useCase.execute('moritz/aisf');

    expect(gitHubWrites.calls).toEqual([]);
  });

  it('should merge nothing when the project is unknown', async () => {
    const unknownProject: ProjectLookup = { find: async () => undefined };
    const { useCase, gitHubWrites } = buildSubject([approvedTicket], unknownProject);

    await useCase.execute('moritz/aisf');

    expect(gitHubWrites.calls).toEqual([]);
  });

  it('should merge the pull request once when a second snapshot arrives during the merge', async () => {
    const { useCase, gitHubWrites } = buildSubject();
    let finishMerge: () => void = () => undefined;
    gitHubWrites.mergeGate = new Promise((resolve) => {
      finishMerge = resolve;
    });

    const firstExecution = useCase.execute('moritz/aisf');
    await useCase.execute('moritz/aisf');
    finishMerge();
    await firstExecution;

    expect(gitHubWrites.calls).toEqual(['rebaseMerge #201 abc123']);
  });

  it('should merge the pull request again when an earlier merge attempt failed', async () => {
    const { useCase, gitHubWrites, logger } = buildSubject();
    gitHubWrites.mergeError = new GitHubWriteFailedError('head moved');

    await useCase.execute('moritz/aisf');
    gitHubWrites.mergeError = undefined;
    await useCase.execute('moritz/aisf');

    expect(gitHubWrites.calls).toEqual(['rebaseMerge #201 abc123', 'rebaseMerge #201 abc123']);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('head moved'));
  });
});
