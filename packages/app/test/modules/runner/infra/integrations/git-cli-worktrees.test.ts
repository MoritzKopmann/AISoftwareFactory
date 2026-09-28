import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitCliWorktrees } from '../../../../../src/modules/runner/infra/integrations/git-cli-worktrees.js';
import { WorktreeSetupFailedError } from '../../../../../src/modules/runner/logic/errors/worktree-setup-failed-error.js';

describe('GitCliWorktrees', () => {
  let rootDirectory: string;
  let checkoutPath: string;
  let worktreePath: string;
  const worktrees = new GitCliWorktrees();
  const gitEnvironment = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };

  function git(workingDirectory: string, ...argumentList: string[]): string {
    return execFileSync('git', argumentList, {
      cwd: workingDirectory,
      env: gitEnvironment,
      encoding: 'utf8',
    }).trim();
  }

  beforeEach(() => {
    rootDirectory = mkdtempSync(join(tmpdir(), 'aisf-worktrees-'));
    const originPath = join(rootDirectory, 'origin.git');
    checkoutPath = join(rootDirectory, 'checkout');
    worktreePath = join(rootDirectory, 'worktrees', 'aisf', '137');
    git(rootDirectory, 'init', '--bare', '--initial-branch=main', originPath);
    git(rootDirectory, 'clone', originPath, checkoutPath);
    writeFileSync(join(checkoutPath, 'readme.md'), 'hello');
    git(checkoutPath, 'add', '.');
    git(checkoutPath, 'commit', '-m', 'initial');
    git(checkoutPath, 'push', '-u', 'origin', 'HEAD:main');
    git(checkoutPath, 'remote', 'set-head', 'origin', 'main');
  });

  afterEach(() => {
    rmSync(rootDirectory, { recursive: true, force: true });
  });

  it('should create the worktree on a new branch from the default branch when the branch does not exist', async () => {
    await worktrees.ensure({ checkoutPath, worktreePath, branchName: 'aisf/137-runner' });

    expect(git(worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('aisf/137-runner');
    expect(existsSync(join(worktreePath, 'readme.md'))).toBe(true);
  });

  it('should leave the worktree as it is when it already exists', async () => {
    await worktrees.ensure({ checkoutPath, worktreePath, branchName: 'aisf/137-runner' });
    writeFileSync(join(worktreePath, 'work-in-progress.md'), 'kept');

    await worktrees.ensure({ checkoutPath, worktreePath, branchName: 'aisf/137-runner' });

    expect(existsSync(join(worktreePath, 'work-in-progress.md'))).toBe(true);
  });

  it('should check out the existing local branch when the worktree directory is gone', async () => {
    await worktrees.ensure({ checkoutPath, worktreePath, branchName: 'aisf/137-runner' });
    git(worktreePath, 'commit', '--allow-empty', '-m', 'earlier work');
    rmSync(worktreePath, { recursive: true, force: true });

    await worktrees.ensure({ checkoutPath, worktreePath, branchName: 'aisf/137-runner' });

    expect(git(worktreePath, 'log', '-1', '--format=%s')).toBe('earlier work');
  });

  it('should continue from the pushed branch when only the remote has it', async () => {
    git(checkoutPath, 'commit', '--allow-empty', '-m', 'pushed work');
    git(checkoutPath, 'push', 'origin', 'HEAD:refs/heads/aisf/137-runner');

    await worktrees.ensure({ checkoutPath, worktreePath, branchName: 'aisf/137-runner' });

    expect(git(worktreePath, 'log', '-1', '--format=%s')).toBe('pushed work');
  });

  it('should throw WorktreeSetupFailedError when the checkout is not a repository', async () => {
    await expect(
      worktrees.ensure({
        checkoutPath: rootDirectory,
        worktreePath,
        branchName: 'aisf/137-runner',
      }),
    ).rejects.toThrow(WorktreeSetupFailedError);
  });
});
