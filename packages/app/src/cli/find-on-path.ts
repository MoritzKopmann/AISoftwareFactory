import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

const notFoundErrorCodes: ReadonlyArray<string> = ['ENOENT', 'ENOTDIR', 'EACCES'];

function isMissingOrNotExecutable(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && notFoundErrorCodes.includes(String(error.code))
  );
}

export function findOnPath(
  command: string,
  searchPath: string = process.env['PATH'] ?? '',
): string | undefined {
  return searchPath
    .split(delimiter)
    .map((directory) => join(directory, command))
    .find((candidate) => {
      try {
        accessSync(candidate, constants.X_OK);
        return true;
      } catch (error) {
        if (!isMissingOrNotExecutable(error)) {
          throw error;
        }
        return false;
      }
    });
}
