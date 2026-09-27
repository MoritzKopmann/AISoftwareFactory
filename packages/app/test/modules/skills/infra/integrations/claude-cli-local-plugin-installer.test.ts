import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { excludeFromGit } from '../../../../../src/modules/skills/infra/integrations/claude-cli-local-plugin-installer.js';
import { SkillsSetupError } from '../../../../../src/modules/skills/logic/errors/skills-setup-error.js';

const runGit = promisify(execFile);

describe('excludeFromGit', () => {
  let workDirectory: string;
  let repositoryPath: string;
  let originalGitConfigGlobal: string | undefined;

  beforeEach(async () => {
    // This machine's own global gitignore already covers .claude/settings.local.json;
    // pointing GIT_CONFIG_GLOBAL at /dev/null isolates these tests from that.
    originalGitConfigGlobal = process.env['GIT_CONFIG_GLOBAL'];
    process.env['GIT_CONFIG_GLOBAL'] = '/dev/null';
    workDirectory = await mkdtemp(join(tmpdir(), 'aisf-exclude-'));
    repositoryPath = join(workDirectory, 'repo');
    await mkdir(repositoryPath, { recursive: true });
    await runGit('git', ['init', '-q'], { cwd: repositoryPath });
  });

  afterEach(async () => {
    if (originalGitConfigGlobal === undefined) {
      delete process.env['GIT_CONFIG_GLOBAL'];
    } else {
      process.env['GIT_CONFIG_GLOBAL'] = originalGitConfigGlobal;
    }
    await rm(workDirectory, { recursive: true, force: true });
  });

  async function isIgnored(relativePath: string): Promise<boolean> {
    try {
      await runGit('git', ['check-ignore', '-q', relativePath], { cwd: repositoryPath });
      return true;
    } catch {
      return false;
    }
  }

  it('should add an unignored path to the exclude file', async () => {
    await excludeFromGit(repositoryPath, ['.aisf/']);

    expect(await isIgnored('.aisf/')).toBe(true);
    const excludeContents = await readFile(join(repositoryPath, '.git', 'info', 'exclude'), 'utf8');
    expect(excludeContents).toContain('.aisf/');
  });

  it('should add settings.local.json to the exclude file when core.excludesFile is overridden', async () => {
    await excludeFromGit(repositoryPath, ['.claude/settings.local.json']);

    expect(await isIgnored('.claude/settings.local.json')).toBe(true);
  });

  it('should leave a file untouched in git status after excluding .aisf/ artifacts', async () => {
    await excludeFromGit(repositoryPath, ['.aisf/']);
    await mkdir(join(repositoryPath, '.aisf', 'artifacts'), { recursive: true });
    await writeFile(join(repositoryPath, '.aisf', 'artifacts', 'note.txt'), 'hello');

    const { stdout } = await runGit('git', ['status', '--porcelain'], { cwd: repositoryPath });

    expect(stdout).toBe('');
  });

  it('should not duplicate an entry that is already ignored', async () => {
    await excludeFromGit(repositoryPath, ['.aisf/']);
    await excludeFromGit(repositoryPath, ['.aisf/']);

    const excludeContents = await readFile(join(repositoryPath, '.git', 'info', 'exclude'), 'utf8');
    expect(excludeContents.match(/\.aisf\//g)).toHaveLength(1);
  });

  it('should throw a setup error instead of a raw process error when git cannot run in the checkout', async () => {
    await expect(
      excludeFromGit(join(workDirectory, 'does-not-exist'), ['.aisf/']),
    ).rejects.toBeInstanceOf(SkillsSetupError);
  });

  it('should land the exclude entry in the common git directory from a worktree checkout', async () => {
    await writeFile(join(repositoryPath, 'README.md'), 'hello');
    await runGit('git', ['add', 'README.md'], { cwd: repositoryPath });
    await runGit(
      'git',
      ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-q', '-m', 'init'],
      {
        cwd: repositoryPath,
      },
    );
    const worktreePath = join(workDirectory, 'worktree');
    await runGit('git', ['worktree', 'add', '-q', worktreePath], { cwd: repositoryPath });

    await excludeFromGit(worktreePath, ['.aisf/']);

    const excludeContents = await readFile(join(repositoryPath, '.git', 'info', 'exclude'), 'utf8');
    expect(excludeContents).toContain('.aisf/');
  });
});
