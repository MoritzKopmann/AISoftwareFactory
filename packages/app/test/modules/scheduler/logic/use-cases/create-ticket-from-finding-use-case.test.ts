import { beforeEach, describe, expect, it } from 'vitest';
import { GitHubWriteFailedError } from '../../../../../src/modules/scheduler/logic/errors/github-write-failed-error.js';
import { FindingNotFoundError } from '../../../../../src/modules/scheduler/logic/errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../../../../../src/modules/scheduler/logic/errors/finding-not-open-error.js';
import { CreateTicketFromFindingUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/create-ticket-from-finding-use-case.js';
import { FakeGitHubWrites, FakeProjectLookup } from '../../fakes/fake-scheduler-ports.js';
import { InMemoryFindingRepository } from '../../fakes/in-memory-finding-repository.js';

const newFinding = {
  projectId: 'moritz/aisf',
  ticketNumber: 141,
  runId: 'run-1',
  kind: 'gap',
  location: 'src/a.ts:12',
  summary: 'Missing retry',
  reportedAt: '2026-09-29T10:00:00.000Z',
} as const;

describe('CreateTicketFromFindingUseCase', () => {
  let findingRepository: InMemoryFindingRepository;
  let gitHubWrites: FakeGitHubWrites;
  let createTicketFromFinding: CreateTicketFromFindingUseCase;

  beforeEach(async () => {
    findingRepository = new InMemoryFindingRepository();
    gitHubWrites = new FakeGitHubWrites();
    createTicketFromFinding = new CreateTicketFromFindingUseCase({
      findingRepository,
      gitHubWrites,
      projectLookup: new FakeProjectLookup(),
      clock: { now: () => '2026-09-29T11:00:00.000Z' },
    });
    await findingRepository.insert(newFinding);
  });

  it('should create one bare idea from the finding when Create ticket is used', async () => {
    await createTicketFromFinding.execute('moritz/aisf', 1);

    expect(gitHubWrites.createdIssues).toEqual([
      {
        title: 'Missing retry',
        body: 'Kind: gap\nLocation: `src/a.ts:12`\n\nFound while implementing #141',
      },
    ]);
  });

  it('should record the new issue number and mark the finding ticketed when the issue is created', async () => {
    gitHubWrites.createdIssueNumber = 207;

    const ticketed = await createTicketFromFinding.execute('moritz/aisf', 1);

    expect(ticketed).toMatchObject({
      state: 'ticketed',
      createdTicketNumber: 207,
      resolvedAt: '2026-09-29T11:00:00.000Z',
    });
    expect(await findingRepository.findById(1)).toEqual(ticketed);
  });

  it('should create only one issue when Create ticket is used twice at once', async () => {
    const outcomes = await Promise.allSettled([
      createTicketFromFinding.execute('moritz/aisf', 1),
      createTicketFromFinding.execute('moritz/aisf', 1),
    ]);

    expect(gitHubWrites.createdIssues).toHaveLength(1);
    expect(outcomes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejection = outcomes.find(({ status }) => status === 'rejected');
    expect(rejection).toMatchObject({ reason: expect.any(FindingNotOpenError) });
  });

  it('should throw FindingNotOpenError when the finding is already ticketed', async () => {
    await createTicketFromFinding.execute('moritz/aisf', 1);

    await expect(createTicketFromFinding.execute('moritz/aisf', 1)).rejects.toThrow(
      FindingNotOpenError,
    );
  });

  it('should reopen the finding and rethrow when GitHub fails to create the issue', async () => {
    gitHubWrites.createIssueError = new GitHubWriteFailedError('rate limited');

    await expect(createTicketFromFinding.execute('moritz/aisf', 1)).rejects.toThrow(
      GitHubWriteFailedError,
    );
    expect((await findingRepository.findById(1))?.state).toBe('open');
  });

  it('should throw FindingNotFoundError when the finding belongs to another project', async () => {
    await expect(createTicketFromFinding.execute('moritz/other', 1)).rejects.toThrow(
      FindingNotFoundError,
    );
    expect(gitHubWrites.createdIssues).toEqual([]);
  });
});
