import { beforeEach, describe, expect, it } from 'vitest';
import { createShowArtifactTool } from '../../../../../src/modules/artifacts/api/tools/create-show-artifact-tool.js';
import { PublishArtifactUseCase } from '../../../../../src/modules/artifacts/logic/use-cases/publish-artifact-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { textResult } from '../../../runner/fakes/text-result.js';
import { FakeArtifactFiles } from '../../fakes/fake-artifact-files.js';
import { InMemoryArtifactRepository } from '../../fakes/in-memory-artifact-repository.js';

const runContext = {
  runId: 'r1',
  projectId: 'o/n',
  ticketNumber: 7,
  worktreePath: '/worktrees/n/7',
};

describe('createShowArtifactTool', () => {
  let artifactRepository: InMemoryArtifactRepository;
  let artifactFiles: FakeArtifactFiles;
  let tool: ReturnType<typeof createShowArtifactTool>;

  beforeEach(() => {
    artifactRepository = new InMemoryArtifactRepository();
    artifactFiles = new FakeArtifactFiles();
    artifactFiles.files.set('/worktrees/n/7/.aisf/artifacts/plan/index.html', '<p>hi</p>');
    tool = createShowArtifactTool(
      new PublishArtifactUseCase({
        artifactRepository,
        artifactFiles,
        identifiers: { next: () => 'a1b2c3-token' },
        clock: new FakeClock('2026-10-06T10:00:00.000Z'),
      }),
    );
  });

  it('should be named aisf_show_artifact', () => {
    expect(tool.name).toBe('aisf_show_artifact');
  });

  it('should publish the page and wait at a checkpoint when the page exists', async () => {
    const result = await tool.execute({ artifactId: 'plan', title: 'Plan review' }, runContext);

    expect(await artifactRepository.listForTicket('o/n', 7)).toMatchObject([
      { token: 'a1b2c3-token', version: 1, runId: 'r1', title: 'Plan review' },
    ]);
    expect(result).toEqual({
      wait: {
        kind: 'checkpoint',
        request: expect.stringContaining('Plan review'),
        artifactId: 'plan',
      },
    });
  });

  it('should keep a URL and the token out of the request when it publishes', async () => {
    const result = await tool.execute({ artifactId: 'plan', title: 'Plan review' }, runContext);

    if (!('wait' in result) || result.wait.kind !== 'checkpoint') {
      throw new Error('Expected a checkpoint wait');
    }
    expect(result.wait.request).not.toContain('a1b2c3-token');
    expect(result.wait.request).not.toContain('/a/');
    expect(result.wait.request).not.toContain('http');
  });

  it('should return error text and write nothing when index.html is missing', async () => {
    artifactFiles.files.clear();

    const result = await tool.execute({ artifactId: 'plan', title: 'Plan review' }, runContext);

    expect(textResult(result).text).toContain('index.html');
    expect(await artifactRepository.listForTicket('o/n', 7)).toEqual([]);
  });

  it.each(['../x', 'a/b', 'Plan', '-plan', 'a'.repeat(65), ''])(
    'should return error text and write nothing when the artifact id is %j',
    async (artifactId) => {
      const result = await tool.execute({ artifactId, title: 'Plan review' }, runContext);

      expect(textResult(result).text).toContain('artifactId');
      expect(await artifactRepository.listForTicket('o/n', 7)).toEqual([]);
    },
  );

  it('should accept the longest valid artifact id when it is 64 characters', async () => {
    const artifactId = `a${'-'.repeat(63)}`;
    artifactFiles.files.set(`/worktrees/n/7/.aisf/artifacts/${artifactId}/index.html`, 'x');

    const result = await tool.execute({ artifactId, title: 'Plan review' }, runContext);

    expect('wait' in result).toBe(true);
  });

  it('should return error text when the title is empty', async () => {
    const result = await tool.execute({ artifactId: 'plan', title: '' }, runContext);

    expect(textResult(result).text).toContain('title');
  });
});
