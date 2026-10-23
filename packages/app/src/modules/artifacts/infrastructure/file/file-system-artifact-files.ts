import { randomUUID } from 'node:crypto';
import { readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { ArtifactFiles } from '../../business/port/file/artifact-files.js';

const indexName = 'index.html';
const designIndexName = 'index.json';
const boardShellName = 'board.html';
const userInputStateFileName = 'user-input-state.json';

const missingFileCodes: ReadonlyArray<string> = [
  'ENOENT',
  'ENOTDIR',
  'EISDIR',
  'ERR_INVALID_ARG_VALUE',
];

/** True for the errors that mean "there is no such file": a missing path, a path through a file, a directory, or a null byte. */
function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof (error as NodeJS.ErrnoException).code === 'string' &&
    missingFileCodes.includes((error as NodeJS.ErrnoException).code ?? '')
  );
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function readTextOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

export class FileSystemArtifactFiles implements ArtifactFiles {
  constructor(private readonly options: { readonly kitDirectory: string }) {}

  hasIndex(directory: string): Promise<boolean> {
    return isFile(join(directory, indexName));
  }

  hasDesignIndex(directory: string): Promise<boolean> {
    return isFile(join(directory, designIndexName));
  }

  readBoardShell(): Promise<string> {
    return readFile(join(this.options.kitDirectory, boardShellName), 'utf8');
  }

  readIndex(directory: string): Promise<string | undefined> {
    return readTextOrUndefined(join(directory, indexName));
  }

  async readAsset(directory: string, relativePath: string): Promise<Uint8Array | undefined> {
    try {
      const realDirectory = await realpath(directory);
      // realpath resolves symlinks and dot segments, so containment is checked on the real path.
      const realFile = await realpath(join(realDirectory, `.${sep}${relativePath}`));
      if (!realFile.startsWith(realDirectory + sep) || !(await stat(realFile)).isFile()) {
        return undefined;
      }
      return await readFile(realFile);
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  readUserInputState(directory: string): Promise<string | undefined> {
    return readTextOrUndefined(join(directory, userInputStateFileName));
  }

  async writeUserInputState(directory: string, userInputState: string): Promise<void> {
    const temporaryPath = join(directory, `.${userInputStateFileName}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, userInputState, 'utf8');
    await rename(temporaryPath, join(directory, userInputStateFileName));
  }
}
