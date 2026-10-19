import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitRefSlotReader } from './git-ref-slot-reader.js';

describe('GitRefSlotReader', () => {
  let rootDirectory: string;
  let originPath: string;
  let checkoutPath: string;
  const gitEnvironment = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };

  function git(workingDirectory: string, ...argumentList: string[]): void {
    execFileSync('git', argumentList, { cwd: workingDirectory, env: gitEnvironment });
  }

  function writeSlot(slotName: string, text: string): void {
    const directory = join(checkoutPath, '.claude', 'skills', slotName);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'SKILL.md'), text);
  }

  beforeEach(() => {
    rootDirectory = mkdtempSync(join(tmpdir(), 'aisf-slot-reader-'));
    originPath = join(rootDirectory, 'origin.git');
    checkoutPath = join(rootDirectory, 'checkout');
    git(rootDirectory, 'init', '--bare', '--initial-branch=main', originPath);
    git(rootDirectory, 'clone', originPath, checkoutPath);
    writeFileSync(join(checkoutPath, 'readme.md'), 'hello');
    git(checkoutPath, 'add', '.');
    git(checkoutPath, 'commit', '-m', 'initial');
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  describe('read', () => {
    it("should return the file content when origin's default branch holds the slot", async () => {
      writeSlot('code-rules', '## Rules');
      git(checkoutPath, 'add', '.');
      git(checkoutPath, 'commit', '-m', 'slot');
      git(checkoutPath, 'push', 'origin', 'HEAD:main');
      git(checkoutPath, 'remote', 'set-head', 'origin', 'main');
      rmSync(join(checkoutPath, '.claude'), { recursive: true });

      const text = await new GitRefSlotReader().read(checkoutPath, 'code-rules');

      expect(text).toBe('## Rules');
    });

    it('should return undefined when only the working tree holds the slot', async () => {
      git(checkoutPath, 'push', 'origin', 'HEAD:main');
      git(checkoutPath, 'remote', 'set-head', 'origin', 'main');
      writeSlot('code-rules', '## Rules');

      const text = await new GitRefSlotReader().read(checkoutPath, 'code-rules');

      expect(text).toBeUndefined();
    });

    it('should return undefined when the checkout has no origin/HEAD', async () => {
      const text = await new GitRefSlotReader().read(checkoutPath, 'project-testing');

      expect(text).toBeUndefined();
    });
  });
});
