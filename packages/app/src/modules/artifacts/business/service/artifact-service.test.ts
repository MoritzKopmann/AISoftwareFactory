import { beforeEach, describe, expect, it } from 'vitest';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import { ArtifactService } from './artifact-service.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import { buildArtifact } from '../../testing/build-artifact.js';
import { FakeArtifactFiles } from '../../testing/fake-artifact-files.js';
import { FakeRunPort } from '../../testing/fake-run-port.js';
import { InMemoryArtifactRepository } from '../../testing/in-memory-artifact-repository.js';

const request = {
  projectId: 'o/n',
  ticketNumber: 7,
  runId: 'r1',
  worktreePath: '/worktrees/n/7',
  artifactId: 'plan',
  title: 'Plan review',
};

describe('ArtifactService.publish', () => {
  let artifactRepository: InMemoryArtifactRepository;
  let artifactFiles: FakeArtifactFiles;
  let service: ArtifactService;
  let tokens: string[];
  let events: FakeEventPublisher;
  let artifactIdsAtEmit: Array<Promise<ReadonlyArray<string>>>;

  beforeEach(() => {
    artifactRepository = new InMemoryArtifactRepository();
    artifactFiles = new FakeArtifactFiles();
    artifactFiles.files.set('/worktrees/n/7/.aisf/artifacts/plan/index.html', '<p>hi</p>');
    tokens = ['T', 'U'];
    events = new FakeEventPublisher();
    artifactIdsAtEmit = [];
    service = new ArtifactService({
      artifactRepository,
      artifactFiles,
      runPort: new FakeRunPort(),
      events: {
        emit: (...emitted: Parameters<FakeEventPublisher['emit']>) => {
          events.emit(...emitted);
          artifactIdsAtEmit.push(
            artifactRepository
              .listForTicket('o/n', 7)
              .then((artifacts) => artifacts.map(({ artifactId }) => artifactId)),
          );
        },
      },
      identifiers: { next: () => tokens.shift() ?? 'spare' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    });
  });

  it('should save the design directory when index.json exists and index.html does not', async () => {
    artifactFiles.files.set('/worktrees/n/7/.aisf/artifacts/design/index.json', '{}');

    const artifact = await service.publish({ ...request, artifactId: 'design' });

    expect(artifact.directory).toBe('/worktrees/n/7/.aisf/artifacts/design');
    expect(await artifactRepository.findByToken('T')).toEqual(artifact);
  });

  it('should throw when the design folder has no index.json', async () => {
    artifactFiles.files.set('/worktrees/n/7/.aisf/artifacts/design/index.html', '<p>x</p>');

    await expect(service.publish({ ...request, artifactId: 'design' })).rejects.toThrow(
      ArtifactNotFoundError,
    );
  });

  it('should store the artifact at version 1 with a new token when the page exists', async () => {
    const artifact = await service.publish(request);

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
    await service.publish(request);

    const republished = await service.publish({ ...request, runId: 'r2', title: 'Plan review 2' });

    expect(republished).toMatchObject({
      token: 'T',
      version: 2,
      runId: 'r2',
      title: 'Plan review 2',
    });
  });

  it('should refuse and store nothing when index.html is missing', async () => {
    artifactFiles.files.clear();

    await expect(service.publish(request)).rejects.toThrow(ArtifactNotFoundError);
    expect(await artifactRepository.listForTicket('o/n', 7)).toEqual([]);
  });

  it('should emit artifact.published once the artifact is listed when it is published', async () => {
    await service.publish(request);

    expect(events.emittedEvents).toEqual([
      {
        name: 'artifact.published',
        payload: { projectId: 'o/n', ticketNumber: 7, artifactId: 'plan' },
      },
    ]);
    expect(await artifactIdsAtEmit[0]).toEqual(['plan']);
  });

  it('should not emit when index.html is missing', async () => {
    artifactFiles.files.clear();

    await expect(service.publish(request)).rejects.toThrow(ArtifactNotFoundError);
    expect(events.emittedEvents).toEqual([]);
  });
});

describe('ArtifactService.publish design round', () => {
  const designDirectory = '/worktrees/n/7/.aisf/artifacts/design';
  let artifactFiles: FakeArtifactFiles;
  let service: ArtifactService;

  const setIndex = (text: string): void => {
    artifactFiles.files.set(`${designDirectory}/index.json`, text);
  };
  const setDraft = (sentRound: number | null): void => {
    artifactFiles.files.set(
      `${designDirectory}/user-input-state.json`,
      JSON.stringify({ rounds: {}, board: { sentRound } }),
    );
  };
  const publishDesign = (): Promise<unknown> =>
    service.publish({ ...request, artifactId: 'design' });
  const indexText = (): string => artifactFiles.files.get(`${designDirectory}/index.json`) ?? '';

  beforeEach(() => {
    artifactFiles = new FakeArtifactFiles();
    service = new ArtifactService({
      artifactRepository: new InMemoryArtifactRepository(),
      artifactFiles,
      runPort: new FakeRunPort(),
      events: new FakeEventPublisher(),
      identifiers: { next: () => 'T' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    });
  });

  it('should raise the round and keep other fields when feedback was sent for the current round', async () => {
    setIndex(JSON.stringify({ title: 'D', brief: 'b', round: 3, boards: [{ id: 'a' }] }));
    setDraft(3);

    await publishDesign();

    expect(JSON.parse(indexText())).toEqual({
      title: 'D',
      brief: 'b',
      round: 4,
      boards: [{ id: 'a' }],
    });
  });

  it('should keep the round when sentRound is null', async () => {
    setIndex('{"round":3}');
    setDraft(null);

    await publishDesign();

    expect(indexText()).toBe('{"round":3}');
  });

  it('should keep the round when there is no draft', async () => {
    setIndex('{"round":3}');

    await publishDesign();

    expect(indexText()).toBe('{"round":3}');
  });

  it('should keep the round when the agent already raised it', async () => {
    setIndex('{"round":4}');
    setDraft(3);

    await publishDesign();

    expect(indexText()).toBe('{"round":4}');
  });

  it('should publish and not write when index.json has no numeric round', async () => {
    setIndex('{"round":"3"}');
    setDraft(3);

    await publishDesign();

    expect(indexText()).toBe('{"round":"3"}');
  });

  it('should publish and not write when index.json is not JSON', async () => {
    setIndex('nope');
    setDraft(3);

    await expect(publishDesign()).resolves.toBeDefined();

    expect(indexText()).toBe('nope');
  });

  it('should publish and not write when the draft is not JSON', async () => {
    setIndex('{"round":3}');
    artifactFiles.files.set(`${designDirectory}/user-input-state.json`, 'nope');

    await expect(publishDesign()).resolves.toBeDefined();

    expect(indexText()).toBe('{"round":3}');
  });

  it('should leave index.json alone when the artifact is another page', async () => {
    artifactFiles.files.set('/worktrees/n/7/.aisf/artifacts/plan-7/index.html', '<p>x</p>');
    artifactFiles.files.set(
      '/worktrees/n/7/.aisf/artifacts/plan-7/user-input-state.json',
      JSON.stringify({ board: { sentRound: 3 } }),
    );
    artifactFiles.files.set('/worktrees/n/7/.aisf/artifacts/plan-7/index.json', '{"round":3}');

    await service.publish({ ...request, artifactId: 'plan-7' });

    expect(artifactFiles.files.get('/worktrees/n/7/.aisf/artifacts/plan-7/index.json')).toBe(
      '{"round":3}',
    );
  });
});

describe('ArtifactService.listForTicket', () => {
  it('should list the ticket artifacts with their page status when asked', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ token: 'T', artifactId: 'plan', title: 'Plan' }));
    artifactRepository.add(buildArtifact({ token: 'U', artifactId: 'notes', title: 'Notes' }));
    artifactRepository.add(buildArtifact({ token: 'V', ticketNumber: 8 }));
    const runPort = new FakeRunPort();
    runPort.latestRun = {
      id: 'r1',
      worktreePath: '/w',
      state: 'running',
      waitingFor: { artifactId: 'plan' },
    };

    const artifacts = await new ArtifactService({
      artifactRepository,
      artifactFiles: new FakeArtifactFiles(),
      runPort,
      events: new FakeEventPublisher(),
      identifiers: { next: () => 'unused' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    }).listForTicket('o/n', 7);

    expect(artifacts).toEqual([
      { artifactId: 'plan', title: 'Plan', token: 'T', status: 'open' },
      { artifactId: 'notes', title: 'Notes', token: 'U', status: 'closed' },
    ]);
  });
});
