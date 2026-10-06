import { describe, expect, it } from 'vitest';
import { ListTicketArtifactsUseCase } from '../../../../../src/modules/bridge/logic/use-cases/list-ticket-artifacts-use-case.js';
import { buildArtifact } from '../../fakes/build-artifact.js';
import { FakeTicketRunLookup } from '../../fakes/fake-ticket-run-lookup.js';
import { InMemoryArtifactRepository } from '../../fakes/in-memory-artifact-repository.js';

describe('ListTicketArtifactsUseCase', () => {
  it('should list the ticket artifacts with their page status when asked', async () => {
    const artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ token: 'T', artifactId: 'plan', title: 'Plan' }));
    artifactRepository.add(buildArtifact({ token: 'U', artifactId: 'notes', title: 'Notes' }));
    artifactRepository.add(buildArtifact({ token: 'V', ticketNumber: 8 }));
    const ticketRunLookup = new FakeTicketRunLookup();
    ticketRunLookup.latestRun = { id: 'r1', state: 'running', waitingFor: { artifactId: 'plan' } };

    const artifacts = await new ListTicketArtifactsUseCase({
      artifactRepository,
      ticketRunLookup,
    }).execute('o/n', 7);

    expect(artifacts).toEqual([
      { artifactId: 'plan', title: 'Plan', token: 'T', status: 'open' },
      { artifactId: 'notes', title: 'Notes', token: 'U', status: 'closed' },
    ]);
  });
});
