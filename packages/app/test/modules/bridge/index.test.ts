import { beforeEach, describe, expect, it } from 'vitest';
import { createBridgeModule, type BridgeModule } from '../../../src/modules/bridge/index.js';
import { FakeClock } from '../../fakes/fake-clock.js';
import { buildArtifact } from './fakes/build-artifact.js';
import { FakeArtifactFiles } from './fakes/fake-artifact-files.js';
import { FakeTicketRunLookup } from './fakes/fake-ticket-run-lookup.js';
import { InMemoryArtifactRepository } from './fakes/in-memory-artifact-repository.js';

describe('createBridgeModule', () => {
  let artifactRepository: InMemoryArtifactRepository;
  let artifactFiles: FakeArtifactFiles;
  let bridge: BridgeModule;

  beforeEach(() => {
    artifactRepository = new InMemoryArtifactRepository();
    artifactFiles = new FakeArtifactFiles();
    bridge = createBridgeModule({
      kitDirectory: '/kit',
      artifactRepository,
      artifactFiles,
      ticketRunLookup: new FakeTicketRunLookup(),
      identifiers: { next: () => 'T' },
      clock: new FakeClock('2026-10-06T10:00:00.000Z'),
    });
  });

  it('should offer the aisf_show_artifact tool when the module is created', () => {
    expect(bridge.tools.map(({ name }) => name)).toEqual(['aisf_show_artifact']);
  });

  it('should serve a published page under the page routes when the tool published it', async () => {
    artifactFiles.files.set('/w/.aisf/artifacts/plan/index.html', '<p>hi</p>');
    await bridge.tools[0]?.execute(
      { artifactId: 'plan', title: 'Plan' },
      { runId: 'r1', projectId: 'o/n', ticketNumber: 7, worktreePath: '/w' },
    );

    const response = await bridge.pageRoutes.request('/T/', { headers: { Host: 'localhost:1' } });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<p>hi</p>');
  });

  it('should list ticket artifacts under /projects when the ticket has some', async () => {
    artifactRepository.add(buildArtifact());

    const response = await bridge.routes.request('/projects/o/n/tickets/7/artifacts');

    expect(await response.json()).toEqual({
      artifacts: [{ artifactId: 'plan', title: 'Plan review', url: '/a/T/', status: 'closed' }],
    });
  });
});
