import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

export function isOnPath(command: string): boolean {
  const directories = (process.env['PATH'] ?? '').split(delimiter);
  return directories.some((directory) => {
    try {
      accessSync(join(directory, command), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}
