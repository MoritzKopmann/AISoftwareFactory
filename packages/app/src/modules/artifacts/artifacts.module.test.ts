import { beforeEach, describe, expect, it } from 'vitest';
import { createArtifactsModule, type ArtifactsModule } from './index.js';
import { InMemoryAgentToolRegistry } from '../../shared/in-memory-agent-tool-registry.js';
import { FakeEventPublisher } from '../../shared/testing/fake-event-publisher.js';
import { FakeClock } from '../../shared/testing/fake-clock.js';
import type { AgentRunsApi } from '../agent-runs/index.js';
import { buildArtifact } from './testing/build-artifact.js';
import { FakeArtifactFiles } from './testing/fake-artifact-files.js';
import { InMemoryArtifactRepository } from './testing/in-memory-artifact-repository.js';

type RunDto = NonNullable<Awaited<ReturnType<AgentRunsApi['latestRun']>>>;

const runningRun: RunDto = {
  id: 'r2',
  projectId: 'o/n',
  ticketNumber: 7,
  stage: 'implement',
  mode: 'afk',
  sessionId: 's1',
  worktreePath: '/w',
  branchName: 'aisf/7-x',
  state: 'running',
  answerHeld: false,
  startedAt: '2026-10-06T10:00:00.000Z',
};

describe('createArtifactsModule', () => {
  let artifactRepository: InMemoryArtifactRepository;
  let artifactFiles: FakeArtifactFiles;
  let agentTools: InMemoryAgentToolRegistry;
  let latestRun: RunDto | undefined;
  let bridge: ArtifactsModule;

  beforeEach(() => {
    artifactRepository = new InMemoryArtifactRepository();
    artifactFiles = new FakeArtifactFiles();
    agentTools = new InMemoryAgentToolRegistry();
    latestRun = undefined;
    bridge = createArtifactsModule(
      {
        database: undefined as never,
        kitDirectory: '/kit',
        agentTools,
        agentRuns: { latestRun: async () => latestRun },
        scheduler: { answer: async () => ({ id: 'r1', startedAt: '2026-10-06T10:00:00.000Z' }) },
        events: new FakeEventPublisher(),
        identifiers: { next: () => 'T' },
        clock: new FakeClock('2026-10-06T10:00:00.000Z'),
      },
      { artifactRepository, artifactFiles },
    );
  });

  it('should register the aisf_show_artifact tool when the module is created', () => {
    expect(agentTools.list().map(({ name }) => name)).toEqual(['aisf_show_artifact']);
  });

  it('should serve a published page under /a when the tool published it', async () => {
    artifactFiles.files.set('/w/.aisf/artifacts/plan/index.html', '<p>hi</p>');
    await agentTools
      .list()[0]
      ?.execute(
        { artifactId: 'plan', title: 'Plan' },
        { runId: 'r1', projectId: 'o/n', ticketNumber: 7, worktreePath: '/w' },
      );

    const response = await bridge.routes.request('/a/T/', { headers: { Host: 'localhost:1' } });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<p>hi</p>');
  });

  it('should list ticket artifacts under /api/projects when the ticket has some', async () => {
    artifactRepository.add(buildArtifact());

    const response = await bridge.routes.request('/api/projects/o/n/tickets/7/artifacts');

    expect(await response.json()).toEqual({
      artifacts: [{ artifactId: 'plan', title: 'Plan review', url: '/a/T/', status: 'closed' }],
    });
  });

  it('should answer 409 busy when a page event is submitted while another run is running', async () => {
    artifactRepository.add(buildArtifact());
    latestRun = runningRun;

    const response = await bridge.routes.request('/a/T/_events', {
      method: 'POST',
      headers: { Host: 'localhost:1', Origin: 'http://localhost:1' },
      body: JSON.stringify({ kind: 'submit', round: 1, payload: {} }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: 'busy' });
  });

  it('should have no jobs when the module is created', () => {
    expect(bridge.jobs).toEqual({});
  });
});
