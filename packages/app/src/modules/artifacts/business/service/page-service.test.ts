import { beforeEach, describe, expect, it } from 'vitest';
import { injectPageBridge } from '../domain/functions/inject-page-bridge.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import { PageBusyError } from '../errors/page-busy-error.js';
import { PageClosedError } from '../errors/page-closed-error.js';
import { PageService } from './page-service.js';
import { buildArtifact } from '../../testing/build-artifact.js';
import { FakeArtifactFiles } from '../../testing/fake-artifact-files.js';
import { FakeCheckpointAnswers } from '../../testing/fake-checkpoint-answers.js';
import { FakeTicketRunLookup } from '../../testing/fake-ticket-run-lookup.js';
import { InMemoryArtifactRepository } from '../../testing/in-memory-artifact-repository.js';

const directory = '/worktrees/n/7/.aisf/artifacts/plan';
const event = { kind: 'submit', round: 2, payload: { a: 1 } } as const;
const tagged = '<aisf-event artifact=plan kind=submit round=2>{"a":1}</aisf-event>';

describe('PageService', () => {
  let artifactFiles: FakeArtifactFiles;
  let ticketRunLookup: FakeTicketRunLookup;
  let checkpointAnswers: FakeCheckpointAnswers;
  let service: PageService;

  beforeEach(() => {
    const artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ directory, version: 2 }));
    artifactFiles = new FakeArtifactFiles();
    ticketRunLookup = new FakeTicketRunLookup();
    checkpointAnswers = new FakeCheckpointAnswers();
    service = new PageService({
      artifactRepository,
      artifactFiles,
      ticketRunLookup,
      checkpointAnswers,
    });
  });

  describe('read', () => {
    it('should return index.html with the bridge when the token is known', async () => {
      artifactFiles.files.set(`${directory}/index.html`, '<p>hi</p>');

      expect(await service.read('T', 'N')).toBe(injectPageBridge('<p>hi</p>', 'N'));
    });

    it('should throw when the token is unknown or the page is gone', async () => {
      await expect(service.read('T', 'N')).rejects.toThrow(ArtifactNotFoundError);
      await expect(service.read('nope', 'N')).rejects.toThrow(ArtifactNotFoundError);
    });
  });

  describe('readAsset', () => {
    it('should return the file when it lies inside the directory', async () => {
      artifactFiles.files.set(`${directory}/app.js`, 'x');

      const content = await service.readAsset('T', 'app.js');

      expect(new TextDecoder().decode(content)).toBe('x');
    });

    it('should throw when the file is missing or the token is unknown', async () => {
      await expect(service.readAsset('T', 'app.js')).rejects.toThrow(ArtifactNotFoundError);
      await expect(service.readAsset('nope', 'app.js')).rejects.toThrow(ArtifactNotFoundError);
    });
  });

  describe('readUserInputState', () => {
    it('should return null when no draft was stored', async () => {
      expect(await service.readUserInputState('T')).toBe('null');
    });

    it('should return the stored draft when one exists', async () => {
      await service.writeUserInputState('T', '{"a":1}');

      expect(await service.readUserInputState('T')).toBe('{"a":1}');
    });

    it('should throw when the token is unknown', async () => {
      await expect(service.readUserInputState('nope')).rejects.toThrow(ArtifactNotFoundError);
    });
  });

  describe('writeUserInputState', () => {
    it('should store nothing and throw when the token is unknown', async () => {
      await expect(service.writeUserInputState('nope', '{}')).rejects.toThrow(
        ArtifactNotFoundError,
      );
      expect(artifactFiles.files.size).toBe(0);
    });
  });

  describe('readStatus', () => {
    it('should report the decided status and the version when the token is known', async () => {
      ticketRunLookup.latestRun = {
        id: 'r1',
        state: 'running',
        waitingFor: { artifactId: 'plan' },
      };

      expect(await service.readStatus('T')).toEqual({ status: 'open', version: 2 });
    });

    it('should report closed when the ticket has no run', async () => {
      expect(await service.readStatus('T')).toEqual({ status: 'closed', version: 2 });
    });

    it('should throw when the token is unknown', async () => {
      await expect(service.readStatus('nope')).rejects.toThrow(ArtifactNotFoundError);
    });
  });

  describe('submitEvent', () => {
    it('should deliver the tagged text to the run when the run waits on the page', async () => {
      ticketRunLookup.latestRun = {
        id: 'r1',
        state: 'running',
        waitingFor: { artifactId: 'plan' },
      };

      await service.submitEvent('T', event);

      expect(checkpointAnswers.calls).toEqual([{ runId: 'r1', text: tagged }]);
    });

    it('should deliver when the run ended at a checkpoint on the page', async () => {
      ticketRunLookup.latestRun = {
        id: 'r1',
        state: 'ended',
        ending: { kind: 'checkpoint', artifactId: 'plan' },
      };

      await service.submitEvent('T', event);

      expect(checkpointAnswers.calls).toEqual([{ runId: 'r1', text: tagged }]);
    });

    it('should throw closed and deliver nothing when the run does not wait', async () => {
      ticketRunLookup.latestRun = { id: 'r1', state: 'running' };

      await expect(service.submitEvent('T', event)).rejects.toThrow(PageClosedError);
      expect(checkpointAnswers.calls).toEqual([]);
    });

    it('should throw busy and deliver nothing when another run is running', async () => {
      ticketRunLookup.latestRun = { id: 'r2', state: 'running' };

      await expect(service.submitEvent('T', event)).rejects.toThrow(PageBusyError);
      expect(checkpointAnswers.calls).toEqual([]);
    });

    it('should pass on busy when the scheduler refuses the answer', async () => {
      ticketRunLookup.latestRun = {
        id: 'r1',
        state: 'running',
        waitingFor: { artifactId: 'plan' },
      };
      checkpointAnswers.failure = new PageBusyError('refused');

      await expect(service.submitEvent('T', event)).rejects.toThrow(PageBusyError);
    });

    it('should throw when the token is unknown', async () => {
      await expect(service.submitEvent('nope', event)).rejects.toThrow(ArtifactNotFoundError);
    });
  });
});
