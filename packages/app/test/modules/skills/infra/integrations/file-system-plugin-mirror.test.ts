import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemPluginMirror } from '../../../../../src/modules/skills/infra/integrations/file-system-plugin-mirror.js';
import { SkillsSetupError } from '../../../../../src/modules/skills/logic/errors/skills-setup-error.js';

describe('FileSystemPluginMirror', () => {
  let workDirectory: string;
  let sourceDirectory: string;
  let mirrorDirectory: string;

  beforeEach(async () => {
    workDirectory = await mkdtemp(join(tmpdir(), 'aisf-mirror-'));
    sourceDirectory = join(workDirectory, 'plugin');
    mirrorDirectory = join(workDirectory, 'home', 'plugins', 'aisf');
    await mkdir(join(sourceDirectory, '.claude-plugin'), { recursive: true });
    await writeFile(join(sourceDirectory, '.claude-plugin', 'plugin.json'), '{"name":"aisf"}');
  });

  afterEach(async () => {
    await rm(workDirectory, { recursive: true, force: true });
  });

  describe('replace', () => {
    it('should copy the plugin including hidden folders when the mirror does not exist', async () => {
      await new FileSystemPluginMirror({ sourceDirectory, mirrorDirectory }).replace();

      expect(await readFile(join(mirrorDirectory, '.claude-plugin', 'plugin.json'), 'utf8')).toBe(
        '{"name":"aisf"}',
      );
    });

    it('should overwrite changed files and drop stale ones when the mirror already exists', async () => {
      const mirror = new FileSystemPluginMirror({ sourceDirectory, mirrorDirectory });
      await mirror.replace();
      await writeFile(join(mirrorDirectory, 'stale.md'), 'old');
      await writeFile(join(sourceDirectory, '.claude-plugin', 'plugin.json'), '{"name":"changed"}');

      await mirror.replace();

      expect(await readFile(join(mirrorDirectory, '.claude-plugin', 'plugin.json'), 'utf8')).toBe(
        '{"name":"changed"}',
      );
      await expect(stat(join(mirrorDirectory, 'stale.md'))).rejects.toThrow();
    });

    it('should throw a setup error when the bundled plugin is missing', async () => {
      const mirror = new FileSystemPluginMirror({
        sourceDirectory: join(workDirectory, 'missing'),
        mirrorDirectory,
      });

      await expect(mirror.replace()).rejects.toBeInstanceOf(SkillsSetupError);
    });
  });
});
