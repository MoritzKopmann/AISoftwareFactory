import { GhCommandFailedError } from '../../../../shared/github/gh-command-failed-error.js';
import { runGhCommand } from '../../../../shared/github/run-gh-command.js';
import { runProcess } from '../../../../shared/process/run-process.js';
import { GitHubAuthError } from '../../logic/errors/github-auth-error.js';
import type { GitHubToken } from './github-token.js';

export class GhCliGitHubToken implements GitHubToken {
  private cachedToken: string | undefined;

  constructor(private readonly runCommand: typeof runProcess = runProcess) {}

  async read(): Promise<string> {
    if (this.cachedToken !== undefined) {
      return this.cachedToken;
    }
    this.cachedToken = await this.readFromGitHubCli();
    return this.cachedToken;
  }

  invalidate(): void {
    this.cachedToken = undefined;
  }

  private async readFromGitHubCli(): Promise<string> {
    let standardOutput: string;
    try {
      standardOutput = await runGhCommand(['auth', 'token'], { runCommand: this.runCommand });
    } catch (error) {
      if (error instanceof GhCommandFailedError) {
        throw new GitHubAuthError(`gh auth token failed (${error.message}): run gh auth login`);
      }
      throw error;
    }
    const token = standardOutput.trim();
    if (token === '') {
      throw new GitHubAuthError('gh auth token failed (no token printed): run gh auth login');
    }
    return token;
  }
}
