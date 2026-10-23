import { watch, type FSWatcher } from 'node:fs';
import { join, posix } from 'node:path';
import type { DesignWatcher } from '../../business/port/watch/design-watcher.js';

const debounceMilliseconds = 150;
const boardsFolder = 'boards';
const missingFolderCodes: ReadonlyArray<string | undefined> = ['ENOENT', 'ENOTDIR'];

function isMissingFolderError(error: unknown): boolean {
  return (
    error instanceof Error && missingFolderCodes.includes((error as NodeJS.ErrnoException).code)
  );
}

function isBoardsFolderEntry(prefix: string, name: string): boolean {
  return prefix === '' && name === boardsFolder;
}

/** Watches a design folder and its `boards/` subfolder, non-recursive. A missing folder is silent. */
export class FileSystemDesignWatcher implements DesignWatcher {
  watch(directory: string, onChange: (file: string) => void): () => void {
    const timers = new Map<string, NodeJS.Timeout>();
    const watchers: FSWatcher[] = [];

    const report = (file: string): void => {
      clearTimeout(timers.get(file));
      timers.set(
        file,
        setTimeout(() => {
          timers.delete(file);
          onChange(file);
        }, debounceMilliseconds),
      );
    };

    const open = (folder: string, prefix: string): void => {
      try {
        const watcher = watch(join(directory, folder), (_event, name) => {
          if (name === null || isBoardsFolderEntry(prefix, name)) {
            return;
          }
          report(posix.join(prefix, name));
        });
        watcher.on('error', () => watcher.close());
        watchers.push(watcher);
      } catch (error) {
        // A missing folder is not an error: nothing fires.
        if (!isMissingFolderError(error)) {
          throw error;
        }
      }
    };

    open('', '');
    open(boardsFolder, boardsFolder);

    return () => {
      watchers.forEach((watcher) => watcher.close());
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }
}
