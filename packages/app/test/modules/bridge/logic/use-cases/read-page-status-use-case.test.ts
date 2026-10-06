import { beforeEach, describe, expect, it } from 'vitest';
import { ArtifactNotFoundError } from '../../../../../src/modules/bridge/logic/errors/artifact-not-found-error.js';
import { ReadPageStatusUseCase } from '../../../../../src/modules/bridge/logic/use-cases/read-page-status-use-case.js';
import { buildArtifact } from '../../fakes/build-artifact.js';
import { FakeTicketRunLookup } from '../../fakes/fake-ticket-run-lookup.js';
import { InMemoryArtifactRepository } from '../../fakes/in-memory-artifact-repository.js';

describe('ReadPageStatusUseCase', () => {
  let artifactRepository: InMemoryArtifactRepository;
  let ticketRunLookup: FakeTicketRunLookup;
  let readStatus: ReadPageStatusUseCase;

  beforeEach(() => {
    artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ version: 2 }));
    ticketRunLookup = new FakeTicketRunLookup();
    readStatus = new ReadPageStatusUseCase({ artifactRepository, ticketRunLookup });
  });

  it('should report the decided status and the version when the token is known', async () => {
    ticketRunLookup.latestRun = {
      id: 'r1',
      state: 'running',
      waitingFor: { artifactId: 'plan' },
    };

    expect(await readStatus.execute('T')).toEqual({ status: 'open', version: 2 });
  });

  it('should report closed when the ticket has no run', async () => {
    expect(await readStatus.execute('T')).toEqual({ status: 'closed', version: 2 });
  });

  it('should throw when the token is unknown', async () => {
    await expect(readStatus.execute('nope')).rejects.toThrow(ArtifactNotFoundError);
  });
});
