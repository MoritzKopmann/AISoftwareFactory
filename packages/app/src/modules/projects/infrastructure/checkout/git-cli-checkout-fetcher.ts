import { runProcess, type ProcessResult } from '../../../../shared/process/run-process.js';
import { GitHubCliError } from '../../business/errors/github-cli-error.js';
import type { CheckoutFetcher } from '../../business/port/checkout/checkout-fetcher.js';

const commandTimeoutMilliseconds = 120_000;

export class GitCliCheckoutFetcher implements CheckoutFetcher {
  async fetch(checkoutPath: string): Promise<void> {
    await this.runGit(checkoutPath, ['fetch', 'origin']);
    await this.runGit(checkoutPath, ['remote', 'set-head', 'origin', '--auto']);
  }

  private async runGit(checkoutPath: string, gitArguments: ReadonlyArray<string>): Promise<void> {
    let result: ProcessResult;
    try {
      result = await runProcess('git', [...gitArguments], {
        workingDirectory: checkoutPath,
        timeoutMilliseconds: commandTimeoutMilliseconds,
      });
    } catch (error) {
      throw new GitHubCliError(error instanceof Error ? error.message : String(error));
    }
    if (result.exitCode !== 0) {
      throw new GitHubCliError(
        result.standardError.trim() || `git ${gitArguments.join(' ')} failed`,
      );
    }
  }
}
