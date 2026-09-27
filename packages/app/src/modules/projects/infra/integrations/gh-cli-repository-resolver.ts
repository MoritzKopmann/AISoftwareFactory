import { existsSync, realpathSync } from 'node:fs';
import { runProcess } from '../../../../shared/process/run-process.js';
import { CheckoutNotARepositoryError } from '../../logic/errors/checkout-not-a-repository-error.js';
import { GitHubCliError } from '../../logic/errors/github-cli-error.js';
import type {
  RepositoryReference,
  RepositoryResolver,
} from '../../logic/ports/repository-resolver.js';

const commandTimeoutMilliseconds = 30_000;
const githubRemotePattern =
  /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)/;

type RepoViewResponse = { readonly owner: { readonly login: string }; readonly name: string };

export class GhCliRepositoryResolver implements RepositoryResolver {
  async resolve(checkoutPath: string): Promise<RepositoryReference> {
    if (!existsSync(checkoutPath)) {
      throw new CheckoutNotARepositoryError(`${checkoutPath} does not exist`);
    }

    const topLevel = await runProcess('git', ['rev-parse', '--show-toplevel'], {
      workingDirectory: checkoutPath,
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
    if (topLevel.exitCode !== 0 || realpathSync(checkoutPath) !== topLevel.standardOutput.trim()) {
      throw new CheckoutNotARepositoryError('Pick the folder that contains .git');
    }

    const origin = await runProcess('git', ['remote', 'get-url', 'origin'], {
      workingDirectory: checkoutPath,
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
    if (origin.exitCode !== 0) {
      throw new CheckoutNotARepositoryError('The checkout has no origin remote');
    }
    const originUrl = origin.standardOutput.trim();

    if (!githubRemotePattern.test(originUrl)) {
      throw new CheckoutNotARepositoryError('The origin remote is not on github.com');
    }

    const repoView = await runProcess('gh', ['repo', 'view', originUrl, '--json', 'owner,name'], {
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
    if (repoView.exitCode !== 0) {
      throw new GitHubCliError(repoView.standardError.trim() || 'gh repo view failed');
    }

    let repoViewResponse: RepoViewResponse;
    try {
      repoViewResponse = JSON.parse(repoView.standardOutput) as RepoViewResponse;
    } catch {
      throw new GitHubCliError('gh repo view returned unreadable output');
    }

    return { owner: repoViewResponse.owner.login, name: repoViewResponse.name };
  }
}
