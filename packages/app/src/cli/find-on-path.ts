import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

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
      } catch {
        return false;
      }
    });
}
