import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runProcess } from '../../../../shared/process/run-process.js';
import type { DetachedWorktreeSpec } from '../../business/domain/types/detached-worktree-spec.js';
import type { WorktreeSpec } from '../../business/domain/types/worktree-spec.js';
import type { RemovableWorktreeSpec } from '../../business/domain/types/removable-worktree-spec.js';
import { WorktreeRemovalFailedError } from '../../business/errors/worktree-removal-failed-error.js';
import { WorktreeSetupFailedError } from '../../business/errors/worktree-setup-failed-error.js';
import type { Worktrees } from '../../business/port/worktree/worktrees.js';

const gitTimeoutMilliseconds = 120_000;
const fallbackBaseRef = 'origin/main';

export class GitCliWorktrees implements Worktrees {
  async ensure(spec: WorktreeSpec): Promise<void> {
    if (existsSync(join(spec.worktreePath, '.git'))) {
      return;
    }

    await this.git(spec.checkoutPath, ['fetch', 'origin']);
    await this.git(spec.checkoutPath, ['worktree', 'prune']);

    if (await this.refExists(spec.checkoutPath, `refs/heads/${spec.branchName}`)) {
      await this.git(spec.checkoutPath, ['worktree', 'add', spec.worktreePath, spec.branchName]);
      return;
    }

    const remoteBranch = `origin/${spec.branchName}`;
    const startPoint = (await this.refExists(spec.checkoutPath, `refs/remotes/${remoteBranch}`))
      ? remoteBranch
      : await this.defaultBaseRef(spec.checkoutPath);
    await this.git(spec.checkoutPath, [
      'worktree',
      'add',
      '-b',
      spec.branchName,
      spec.worktreePath,
      startPoint,
    ]);
  }

  async ensureDetached(spec: DetachedWorktreeSpec): Promise<void> {
    await this.git(spec.checkoutPath, ['fetch', 'origin']);
    const baseRef = await this.defaultBaseRef(spec.checkoutPath);
    if (existsSync(join(spec.worktreePath, '.git'))) {
      await this.git(spec.worktreePath, ['checkout', '--detach', baseRef]);
      return;
    }
    await this.git(spec.checkoutPath, ['worktree', 'prune']);
    await this.git(spec.checkoutPath, ['worktree', 'add', '--detach', spec.worktreePath, baseRef]);
  }

  async remove(spec: RemovableWorktreeSpec): Promise<void> {
    if (!existsSync(spec.worktreePath)) {
      return;
    }
    try {
      if (existsSync(join(spec.worktreePath, '.git'))) {
        await this.git(
          spec.checkoutPath,
          ['worktree', 'remove', '--force', spec.worktreePath],
          WorktreeRemovalFailedError,
        );
      }
      await rm(spec.worktreePath, { recursive: true, force: true });
    } catch (error) {
      if (error instanceof WorktreeRemovalFailedError) {
        throw error;
      }
      throw new WorktreeRemovalFailedError(
        `Removing ${spec.worktreePath} failed: ${String(error)}`,
      );
    }
    await this.git(spec.checkoutPath, ['worktree', 'prune'], WorktreeRemovalFailedError);
  }

  private async refExists(checkoutPath: string, ref: string): Promise<boolean> {
    const result = await runProcess('git', ['show-ref', '--verify', '--quiet', ref], {
      workingDirectory: checkoutPath,
      timeoutMilliseconds: gitTimeoutMilliseconds,
    });
    return result.exitCode === 0;
  }

  private async defaultBaseRef(checkoutPath: string): Promise<string> {
    const result = await runProcess(
      'git',
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      { workingDirectory: checkoutPath, timeoutMilliseconds: gitTimeoutMilliseconds },
    );
    const baseRef = result.standardOutput.trim();
    return result.exitCode === 0 && baseRef !== '' ? baseRef : fallbackBaseRef;
  }

  private async git(
    checkoutPath: string,
    argumentList: ReadonlyArray<string>,
    ErrorType:
      | typeof WorktreeSetupFailedError
      | typeof WorktreeRemovalFailedError = WorktreeSetupFailedError,
  ): Promise<void> {
    try {
      const result = await runProcess('git', argumentList, {
        workingDirectory: checkoutPath,
        timeoutMilliseconds: gitTimeoutMilliseconds,
      });
      if (result.exitCode !== 0) {
        throw new ErrorType(`git ${argumentList.join(' ')} failed: ${result.standardError.trim()}`);
      }
    } catch (error) {
      if (error instanceof ErrorType) {
        throw error;
      }
      throw new ErrorType(`git ${argumentList.join(' ')} could not run: ${String(error)}`);
    }
  }
}
