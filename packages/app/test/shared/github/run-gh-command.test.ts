import { describe, expect, it } from 'vitest';
import { GhCommandFailedError } from '../../../src/shared/github/gh-command-failed-error.js';
import { runGhCommand } from '../../../src/shared/github/run-gh-command.js';
import type { ProcessResult, RunProcessOptions } from '../../../src/shared/process/run-process.js';

type RecordedCommand = {
  readonly command: string;
  readonly argumentList: ReadonlyArray<string>;
  readonly options: RunProcessOptions;
};

function createScriptedCommand(result: ProcessResult | Error) {
  const recordedCommands: RecordedCommand[] = [];
  const runCommand = async (
    command: string,
    argumentList: ReadonlyArray<string>,
    options: RunProcessOptions,
  ): Promise<ProcessResult> => {
    recordedCommands.push({ command, argumentList, options });
    if (result instanceof Error) {
      throw result;
    }
    return result;
  };
  return { runCommand, recordedCommands };
}

function exit(exitCode: number, standardError = '', standardOutput = ''): ProcessResult {
  return { standardOutput, standardError, exitCode };
}

describe('runGhCommand', () => {
  it('should append the repository and a 30 s timeout when a repository is given', async () => {
    const { runCommand, recordedCommands } = createScriptedCommand(exit(0));

    await runGhCommand(['issue', 'view', '5'], {
      repository: { owner: 'acme', name: 'app' },
      runCommand,
    });

    expect(recordedCommands).toEqual([
      {
        command: 'gh',
        argumentList: ['issue', 'view', '5', '--repo', 'acme/app'],
        options: { timeoutMilliseconds: 30_000 },
      },
    ]);
  });

  it('should append nothing when no repository is given', async () => {
    const { runCommand, recordedCommands } = createScriptedCommand(exit(0));
    const argumentList = ['repo', 'view', 'https://github.com/acme/app', '--json', 'owner,name'];

    await runGhCommand(argumentList, { runCommand });

    expect(recordedCommands[0]?.argumentList).toEqual(argumentList);
  });

  it('should return stdout when gh exits 0', async () => {
    const { runCommand } = createScriptedCommand(exit(0, '', 'out\n'));

    await expect(runGhCommand(['label', 'list'], { runCommand })).resolves.toBe('out\n');
  });

  it('should throw the trimmed stderr when gh exits non-zero', async () => {
    const { runCommand } = createScriptedCommand(exit(1, '  not found \n'));

    const failure = runGhCommand(['label', 'list'], { runCommand });

    await expect(failure).rejects.toBeInstanceOf(GhCommandFailedError);
    await expect(failure).rejects.toThrow('not found');
  });

  it('should name the subcommand when gh exits non-zero with empty stderr', async () => {
    const { runCommand } = createScriptedCommand(exit(1));

    await expect(runGhCommand(['label', 'list', '--json', 'name'], { runCommand })).rejects.toThrow(
      new GhCommandFailedError('gh label list failed'),
    );
  });

  it('should throw with the original error as cause when the process fails', async () => {
    const original = new Error('spawn gh ENOENT');
    const { runCommand } = createScriptedCommand(original);

    const failure = await runGhCommand(['label', 'list'], { runCommand }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(GhCommandFailedError);
    expect((failure as GhCommandFailedError).message).toBe('spawn gh ENOENT');
    expect((failure as GhCommandFailedError).cause).toBe(original);
  });
});
