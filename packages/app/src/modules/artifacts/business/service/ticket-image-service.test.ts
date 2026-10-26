import { beforeEach, describe, expect, it } from 'vitest';
import { TicketImageService } from './ticket-image-service.js';
import { FakeArtifactFiles } from '../../testing/fake-artifact-files.js';
import { FakeRunPort } from '../../testing/fake-run-port.js';

const PROJECT_ID = 'project-1';

describe('TicketImageService', () => {
  let artifactFiles: FakeArtifactFiles;
  let runPort: FakeRunPort;
  let service: TicketImageService;

  beforeEach(() => {
    artifactFiles = new FakeArtifactFiles();
    runPort = new FakeRunPort();
    service = new TicketImageService({ runPort, artifactFiles });
  });

  describe('list', () => {
    it('should list the images of the latest run worktree when the run exists', async () => {
      runPort.latestRun = { id: 'r1', worktreePath: '/w/41', state: 'ended' };
      artifactFiles.files.set('/w/41/.aisf/images/card-light.png', 'x');

      const names = await service.list(PROJECT_ID, 41);

      expect(names).toEqual(['card-light.png']);
    });

    it('should return an empty list when the ticket has no run', async () => {
      const names = await service.list(PROJECT_ID, 42);

      expect(names).toEqual([]);
    });
  });

  describe('read', () => {
    it('should return the bytes when the image exists', async () => {
      runPort.latestRun = { id: 'r1', worktreePath: '/w/41', state: 'ended' };
      artifactFiles.files.set('/w/41/.aisf/images/card-light.png', 'x');

      const image = await service.read(PROJECT_ID, 41, 'card-light.png');

      expect(image?.bytes).toEqual(new TextEncoder().encode('x'));
    });

    it('should return undefined when the ticket has no run', async () => {
      const image = await service.read(PROJECT_ID, 42, 'card-light.png');

      expect(image).toBeUndefined();
    });

    it('should return undefined when the name is outside the folder', async () => {
      runPort.latestRun = { id: 'r1', worktreePath: '/w/41', state: 'ended' };
      artifactFiles.files.set('/w/41/.aisf/secret.png', 'x');

      const image = await service.read(PROJECT_ID, 41, '../secret.png');

      expect(image).toBeUndefined();
    });
  });
});
