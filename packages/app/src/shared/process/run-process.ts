import { execFile } from 'node:child_process';

export type RunProcessOptions = {
  readonly workingDirectory?: string;
  readonly timeoutMilliseconds: number;
};

export type ProcessResult = {
  readonly standardOutput: string;
  readonly standardError: string;
  readonly exitCode: number;
};

const maximumOutputBytes = 16 * 1024 * 1024;

export function runProcess(
  command: string,
  argumentList: ReadonlyArray<string>,
  options: RunProcessOptions,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      [...argumentList],
      {
        ...(options.workingDirectory === undefined ? {} : { cwd: options.workingDirectory }),
        timeout: options.timeoutMilliseconds,
        maxBuffer: maximumOutputBytes,
      },
      (error, standardOutput, standardError) => {
        if (error === null) {
          resolve({ standardOutput, standardError, exitCode: 0 });
          return;
        }
        if (typeof error.code !== 'number') {
          reject(error);
          return;
        }
        resolve({ standardOutput, standardError, exitCode: error.code });
      },
    );
  });
}
