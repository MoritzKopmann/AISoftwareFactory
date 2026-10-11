import { runProcess } from '../../../../shared/process/run-process.js';
import { GitHubAuthError } from '../../logic/errors/github-auth-error.js';
import type { GitHubToken } from '../../logic/ports/github-token.js';

const commandTimeoutMilliseconds = 30_000;

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
    let result;
    try {
      result = await this.runCommand('gh', ['auth', 'token'], {
        timeoutMilliseconds: commandTimeoutMilliseconds,
      });
    } catch (error) {
      throw new GitHubAuthError(
        `gh auth token could not run (${String(error)}): run gh auth login`,
      );
    }
    const token = result.standardOutput.trim();
    if (result.exitCode !== 0 || token === '') {
      const detail = result.standardError.trim() || `exit code ${result.exitCode}`;
      throw new GitHubAuthError(`gh auth token failed (${detail}): run gh auth login`);
    }
    return token;
  }
}
