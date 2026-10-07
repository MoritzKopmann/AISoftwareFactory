import { existsSync, realpathSync } from 'node:fs';
import { GhCommandFailedError } from '../../../../shared/github/gh-command-failed-error.js';
import { runGhCommand } from '../../../../shared/github/run-gh-command.js';
import { runProcess } from '../../../../shared/process/run-process.js';
import { CheckoutNotARepositoryError } from '../../logic/errors/checkout-not-a-repository-error.js';
import { RepositoryResolutionFailedError } from '../../logic/errors/repository-resolution-failed-error.js';
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

    let repoView: string;
    try {
      repoView = await runGhCommand(['repo', 'view', originUrl, '--json', 'owner,name']);
    } catch (error) {
      if (error instanceof GhCommandFailedError) {
        throw new RepositoryResolutionFailedError(error.message);
      }
      throw error;
    }

    let repoViewResponse: RepoViewResponse;
    try {
      repoViewResponse = JSON.parse(repoView) as RepoViewResponse;
    } catch {
      throw new RepositoryResolutionFailedError('gh repo view returned unreadable output');
    }

    return { owner: repoViewResponse.owner.login, name: repoViewResponse.name };
  }
}
