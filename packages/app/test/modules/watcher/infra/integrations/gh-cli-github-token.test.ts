import { describe, expect, it } from 'vitest';
import { GhCliGitHubToken } from '../../../../../src/modules/watcher/infra/integrations/gh-cli-github-token.js';
import { GitHubAuthError } from '../../../../../src/modules/watcher/logic/errors/github-auth-error.js';
import type { ProcessResult } from '../../../../../src/shared/process/run-process.js';

type RecordedCommand = { readonly command: string; readonly argumentList: ReadonlyArray<string> };

function createScriptedCommand(results: ReadonlyArray<ProcessResult | Error>) {
  const recordedCommands: RecordedCommand[] = [];
  const runCommand = async (
    command: string,
    argumentList: ReadonlyArray<string>,
  ): Promise<ProcessResult> => {
    recordedCommands.push({ command, argumentList });
    const result = results[recordedCommands.length - 1];
    if (result === undefined) {
      throw new Error('no scripted result left');
    }
    if (result instanceof Error) {
      throw result;
    }
    return result;
  };
  return { runCommand, recordedCommands };
}

function tokenOutput(token: string): ProcessResult {
  return { standardOutput: `${token}\n`, standardError: '', exitCode: 0 };
}

describe('GhCliGitHubToken', () => {
  describe('read', () => {
    it('should run gh auth token once and return the trimmed token when read twice', async () => {
      const { runCommand, recordedCommands } = createScriptedCommand([tokenOutput('gho_first')]);
      const token = new GhCliGitHubToken(runCommand);

      const firstRead = await token.read();
      const secondRead = await token.read();

      expect(firstRead).toBe('gho_first');
      expect(secondRead).toBe('gho_first');
      expect(recordedCommands).toEqual([{ command: 'gh', argumentList: ['auth', 'token'] }]);
    });

    it('should run gh auth token again and return the new token when read after invalidate', async () => {
      const { runCommand, recordedCommands } = createScriptedCommand([
        tokenOutput('gho_stale'),
        tokenOutput('gho_fresh'),
      ]);
      const token = new GhCliGitHubToken(runCommand);
      await token.read();

      token.invalidate();
      const rereadToken = await token.read();

      expect(rereadToken).toBe('gho_fresh');
      expect(recordedCommands).toHaveLength(2);
    });

    it('should throw GitHubAuthError naming gh auth login when gh auth token exits non-zero', async () => {
      const { runCommand } = createScriptedCommand([
        { standardOutput: '', standardError: 'You are not logged in', exitCode: 1 },
      ]);

      const failure = new GhCliGitHubToken(runCommand).read();

      await expect(failure).rejects.toBeInstanceOf(GitHubAuthError);
      await expect(failure).rejects.toThrow('gh auth login');
    });

    it('should throw GitHubAuthError naming gh auth login when gh cannot be started', async () => {
      const { runCommand } = createScriptedCommand([new Error('spawn gh ENOENT')]);

      const failure = new GhCliGitHubToken(runCommand).read();

      await expect(failure).rejects.toBeInstanceOf(GitHubAuthError);
      await expect(failure).rejects.toThrow('gh auth login');
    });

    it('should throw GitHubAuthError naming gh auth login when gh prints no token', async () => {
      const { runCommand } = createScriptedCommand([tokenOutput('')]);

      const failure = new GhCliGitHubToken(runCommand).read();

      await expect(failure).rejects.toBeInstanceOf(GitHubAuthError);
      await expect(failure).rejects.toThrow('gh auth login');
    });
  });
});
