import { beforeEach, describe, expect, it } from 'vitest';
import { ArtifactNotFoundError } from '../../../../../src/modules/artifacts/logic/errors/artifact-not-found-error.js';
import { ReadPageAssetUseCase } from '../../../../../src/modules/artifacts/logic/use-cases/read-page-asset-use-case.js';
import { ReadPageUserInputStateUseCase } from '../../../../../src/modules/artifacts/logic/use-cases/read-page-user-input-state-use-case.js';
import { injectPageBridge } from '../../../../../src/modules/artifacts/logic/domain/functions/inject-page-bridge.js';
import { ReadPageUseCase } from '../../../../../src/modules/artifacts/logic/use-cases/read-page-use-case.js';
import { WritePageUserInputStateUseCase } from '../../../../../src/modules/artifacts/logic/use-cases/write-page-user-input-state-use-case.js';
import { buildArtifact } from '../../fakes/build-artifact.js';
import { FakeArtifactFiles } from '../../fakes/fake-artifact-files.js';
import { InMemoryArtifactRepository } from '../../fakes/in-memory-artifact-repository.js';

const directory = '/worktrees/n/7/.aisf/artifacts/plan';

describe('page file use cases', () => {
  let artifactFiles: FakeArtifactFiles;
  let dependencies: {
    artifactRepository: InMemoryArtifactRepository;
    artifactFiles: FakeArtifactFiles;
  };

  beforeEach(() => {
    const artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact({ directory }));
    artifactFiles = new FakeArtifactFiles();
    dependencies = { artifactRepository, artifactFiles };
  });

  describe('ReadPageUseCase', () => {
    it('should return index.html when the token is known', async () => {
      artifactFiles.files.set(`${directory}/index.html`, '<p>hi</p>');

      expect(await new ReadPageUseCase(dependencies).execute('T', 'N')).toBe(
        injectPageBridge('<p>hi</p>', 'N'),
      );
    });

    it('should throw when the token is unknown or the page is gone', async () => {
      await expect(new ReadPageUseCase(dependencies).execute('T', 'N')).rejects.toThrow(
        ArtifactNotFoundError,
      );
      await expect(new ReadPageUseCase(dependencies).execute('nope', 'N')).rejects.toThrow(
        ArtifactNotFoundError,
      );
    });
  });

  describe('ReadPageAssetUseCase', () => {
    it('should return the file when it lies inside the directory', async () => {
      artifactFiles.files.set(`${directory}/app.js`, 'x');

      const content = await new ReadPageAssetUseCase(dependencies).execute('T', 'app.js');

      expect(new TextDecoder().decode(content)).toBe('x');
    });

    it('should throw when the file is missing or the token is unknown', async () => {
      await expect(new ReadPageAssetUseCase(dependencies).execute('T', 'app.js')).rejects.toThrow(
        ArtifactNotFoundError,
      );
      await expect(
        new ReadPageAssetUseCase(dependencies).execute('nope', 'app.js'),
      ).rejects.toThrow(ArtifactNotFoundError);
    });
  });

  describe('ReadPageUserInputStateUseCase', () => {
    it('should return null when no draft was stored', async () => {
      expect(await new ReadPageUserInputStateUseCase(dependencies).execute('T')).toBe('null');
    });

    it('should return the stored draft when one exists', async () => {
      await new WritePageUserInputStateUseCase(dependencies).execute('T', '{"a":1}');

      expect(await new ReadPageUserInputStateUseCase(dependencies).execute('T')).toBe('{"a":1}');
    });

    it('should throw when the token is unknown', async () => {
      await expect(new ReadPageUserInputStateUseCase(dependencies).execute('nope')).rejects.toThrow(
        ArtifactNotFoundError,
      );
    });
  });

  describe('WritePageUserInputStateUseCase', () => {
    it('should store nothing and throw when the token is unknown', async () => {
      await expect(
        new WritePageUserInputStateUseCase(dependencies).execute('nope', '{}'),
      ).rejects.toThrow(ArtifactNotFoundError);
      expect(artifactFiles.files.size).toBe(0);
    });
  });
});
