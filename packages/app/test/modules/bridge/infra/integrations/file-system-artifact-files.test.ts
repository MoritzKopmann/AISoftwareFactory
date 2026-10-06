import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemArtifactFiles } from '../../../../../src/modules/bridge/infra/integrations/file-system-artifact-files.js';

describe('FileSystemArtifactFiles', () => {
  let root: string;
  let directory: string;
  let files: FileSystemArtifactFiles;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aisf-artifact-files-'));
    directory = join(root, 'plan');
    mkdirSync(directory);
    files = new FileSystemArtifactFiles();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('hasIndex and readIndex', () => {
    it('should report and read index.html when it exists', async () => {
      writeFileSync(join(directory, 'index.html'), '<p>hi</p>');

      expect(await files.hasIndex(directory)).toBe(true);
      expect(await files.readIndex(directory)).toBe('<p>hi</p>');
    });

    it('should report no index when the file or the directory is missing', async () => {
      expect(await files.hasIndex(directory)).toBe(false);
      expect(await files.readIndex(directory)).toBeUndefined();
      expect(await files.hasIndex(join(root, 'gone'))).toBe(false);
    });
  });

  describe('readAsset', () => {
    it('should return the file bytes when the file lies inside the directory', async () => {
      mkdirSync(join(directory, 'sub'));
      writeFileSync(join(directory, 'sub', 'app.js'), 'x');

      const content = await files.readAsset(directory, 'sub/app.js');

      expect(new TextDecoder().decode(content)).toBe('x');
    });

    it('should return undefined when the path climbs out of the directory', async () => {
      writeFileSync(join(root, 'secret'), 'S');

      expect(await files.readAsset(directory, '../secret')).toBeUndefined();
      expect(await files.readAsset(directory, '%2e%2e/secret')).toBeUndefined();
      expect(await files.readAsset(directory, '/etc/passwd')).toBeUndefined();
    });

    it('should return undefined when the path is a symlink out of the directory', async () => {
      writeFileSync(join(root, 'secret'), 'S');
      symlinkSync(join(root, 'secret'), join(directory, 'link'));

      expect(await files.readAsset(directory, 'link')).toBeUndefined();
    });

    it('should return undefined when the file is missing, a directory or has a null byte', async () => {
      mkdirSync(join(directory, 'sub'));

      expect(await files.readAsset(directory, 'missing.js')).toBeUndefined();
      expect(await files.readAsset(directory, 'sub')).toBeUndefined();
      expect(await files.readAsset(directory, 'a\0b')).toBeUndefined();
    });
  });

  describe('readState and writeState', () => {
    it('should return undefined when no state was written', async () => {
      expect(await files.readState(directory)).toBeUndefined();
    });

    it('should return the written text and leave no temp file when state is written twice', async () => {
      await files.writeState(directory, '{"a":1}');
      await files.writeState(directory, '{"a":2}');

      expect(await files.readState(directory)).toBe('{"a":2}');
      expect(readdirSync(directory)).toEqual(['state.json']);
    });
  });
});
