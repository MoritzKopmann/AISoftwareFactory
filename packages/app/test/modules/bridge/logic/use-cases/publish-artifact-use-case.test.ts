import { beforeEach, describe, expect, it } from 'vitest';
import { ArtifactNotFoundError } from '../../../../../src/modules/bridge/logic/errors/artifact-not-found-error.js';
import { PublishArtifactUseCase } from '../../../../../src/modules/bridge/logic/use-cases/publish-artifact-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeArtifactFiles } from '../../fakes/fake-artifact-files.js';
import { InMemoryArtifactRepository } from '../../fakes/in-memory-artifact-repository.js';

const request = {
  projectId: 'o/n',
  ticketNumber: 7,
  runId: 'r1',
  worktreePath: '/worktrees/n/7',
  artifactId: 'plan',
  title: 'Plan review',
};

describe('PublishArtifactUseCase', () => {
  let artifactRepository: InMemoryArtifactRepository;
  let artifactFiles: FakeArtifactFiles;
  let publish: PublishArtifactUseCase;
  let tokens: string[];

  beforeEach(() => {
    artifactRepository = new InMemoryArtifactRepository();
    artifactFiles = new FakeArtifactFiles();
    artifactFiles.files.set('/worktrees/n/7/.aisf/artifacts/plan/index.html', '<p>hi</p>');
    tokens = ['T', 'U'];
    publish = new PublishArtifactUseCase({
      artifactRepository,
      artifactFiles,
      identifiers: { next: () => tokens.shift() ?? 'spare' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    });
  });

  it('should store the artifact at version 1 with a new token when the page exists', async () => {
    const artifact = await publish.execute(request);

    expect(artifact).toEqual({
      token: 'T',
      projectId: 'o/n',
      ticketNumber: 7,
      artifactId: 'plan',
      title: 'Plan review',
      directory: '/worktrees/n/7/.aisf/artifacts/plan',
      runId: 'r1',
      version: 1,
      publishedAt: '2026-10-06T10:00:00.000Z',
    });
    expect(await artifactRepository.findByToken('T')).toEqual(artifact);
  });

  it('should keep the token and add a version when the artifact is published again', async () => {
    await publish.execute(request);

    const republished = await publish.execute({ ...request, runId: 'r2', title: 'Plan review 2' });

    expect(republished).toMatchObject({
      token: 'T',
      version: 2,
      runId: 'r2',
      title: 'Plan review 2',
    });
  });

  it('should refuse and store nothing when index.html is missing', async () => {
    artifactFiles.files.clear();

    await expect(publish.execute(request)).rejects.toThrow(ArtifactNotFoundError);
    expect(await artifactRepository.listForTicket('o/n', 7)).toEqual([]);
  });
});
