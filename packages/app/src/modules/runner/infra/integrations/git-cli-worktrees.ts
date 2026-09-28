import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runProcess } from '../../../../shared/process/run-process.js';
import type { WorktreeSpec } from '../../logic/domain/types/worktree-spec.js';
import { WorktreeSetupFailedError } from '../../logic/errors/worktree-setup-failed-error.js';
import type { Worktrees } from '../../logic/ports/worktrees.js';

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

  private async git(checkoutPath: string, argumentList: ReadonlyArray<string>): Promise<void> {
    try {
      const result = await runProcess('git', argumentList, {
        workingDirectory: checkoutPath,
        timeoutMilliseconds: gitTimeoutMilliseconds,
      });
      if (result.exitCode !== 0) {
        throw new WorktreeSetupFailedError(
          `git ${argumentList.join(' ')} failed: ${result.standardError.trim()}`,
        );
      }
    } catch (error) {
      if (error instanceof WorktreeSetupFailedError) {
        throw error;
      }
      throw new WorktreeSetupFailedError(
        `git ${argumentList.join(' ')} could not run: ${String(error)}`,
      );
    }
  }
}
