import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnvironmentCredentialSource } from '../../../../../src/modules/skills/infra/integrations/environment-credential-source.js';

describe('EnvironmentCredentialSource', () => {
  let projectDirectory: string;

  beforeEach(async () => {
    projectDirectory = await mkdtemp(join(tmpdir(), 'aisf-credential-source-'));
    await mkdir(join(projectDirectory, '.claude'));
  });

  afterEach(async () => {
    await rm(projectDirectory, { recursive: true, force: true });
  });

  describe('read', () => {
    it('should list the environment variables that have a value', async () => {
      const source = new EnvironmentCredentialSource({
        environment: { ANTHROPIC_API_KEY: 'sk-test', EMPTY: '', UNSET: undefined },
        projectDirectory,
      });

      const snapshot = await source.read();

      expect(snapshot.setEnvironmentVariables).toEqual(['ANTHROPIC_API_KEY']);
    });

    it('should name each settings file that defines an apiKeyHelper', async () => {
      await writeFile(
        join(projectDirectory, '.claude', 'settings.json'),
        JSON.stringify({ apiKeyHelper: './get-key.sh' }),
      );
      await writeFile(
        join(projectDirectory, '.claude', 'settings.local.json'),
        JSON.stringify({ apiKeyHelper: './other.sh' }),
      );

      const snapshot = await new EnvironmentCredentialSource({
        environment: {},
        projectDirectory,
      }).read();

      expect(snapshot.apiKeyHelperFiles).toEqual([
        '.claude/settings.json',
        '.claude/settings.local.json',
      ]);
    });

    it('should report no helper when the settings files do not define one', async () => {
      await writeFile(
        join(projectDirectory, '.claude', 'settings.json'),
        JSON.stringify({ permissions: {} }),
      );

      const snapshot = await new EnvironmentCredentialSource({
        environment: {},
        projectDirectory,
      }).read();

      expect(snapshot.apiKeyHelperFiles).toEqual([]);
    });

    it('should report no helper when there is no .claude directory', async () => {
      await rm(join(projectDirectory, '.claude'), { recursive: true });

      const snapshot = await new EnvironmentCredentialSource({
        environment: {},
        projectDirectory,
      }).read();

      expect(snapshot.apiKeyHelperFiles).toEqual([]);
    });
  });
});
