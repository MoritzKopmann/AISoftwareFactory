import { execFile } from 'node:child_process';
import { SkillsSetupError } from '../../logic/errors/skills-setup-error.js';

export type RunClaudeOptions = {
  readonly workingDirectory?: string;
  readonly timeoutMilliseconds: number;
};

const maximumOutputBytes = 16 * 1024 * 1024;

export function runClaude(
  argumentList: ReadonlyArray<string>,
  options: RunClaudeOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claude',
      [...argumentList],
      {
        ...(options.workingDirectory === undefined ? {} : { cwd: options.workingDirectory }),
        timeout: options.timeoutMilliseconds,
        maxBuffer: maximumOutputBytes,
      },
      (error, standardOutput, standardError) => {
        if (error !== null) {
          const detail = standardError.trim() || error.message;
          reject(new SkillsSetupError(`claude ${argumentList.join(' ')} failed: ${detail}`));
          return;
        }
        resolve(standardOutput);
      },
    );
  });
}
