import { randomUUID } from 'node:crypto';
import { readdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import type { ArtifactFiles } from '../../business/port/file/artifact-files.js';

const indexName = 'index.html';
const designIndexName = 'index.json';
const boardShellName = 'board.html';
const userInputStateFileName = 'user-input-state.json';

const imageExtensions: ReadonlyArray<string> = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

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

/** True when `name` resolves, through symlinks, to a file inside the real directory. */
async function isContainedFile(realDirectory: string, name: string): Promise<boolean> {
  try {
    const realFile = await realpath(join(realDirectory, name));
    return realFile.startsWith(realDirectory + sep) && (await stat(realFile)).isFile();
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
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

  async listImages(directory: string): Promise<ReadonlyArray<string>> {
    try {
      const realDirectory = await realpath(directory);
      const names = (await readdir(realDirectory)).filter((name) =>
        imageExtensions.includes(extname(name).toLowerCase()),
      );
      const contained = await Promise.all(
        names.map((name) => isContainedFile(realDirectory, name)),
      );
      return names.filter((_, index) => contained[index]).sort();
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
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

  async readDesignRound(directory: string): Promise<number | undefined> {
    const text = await readTextOrUndefined(join(directory, designIndexName));
    if (text === undefined) {
      return undefined;
    }
    const round = parseDesignIndex(text)?.['round'];
    return typeof round === 'number' ? round : undefined;
  }

  async writeDesignRound(directory: string, round: number): Promise<void> {
    const text = await readTextOrUndefined(join(directory, designIndexName));
    const index = text === undefined ? undefined : parseDesignIndex(text);
    if (index === undefined) {
      return;
    }
    const temporaryPath = join(directory, `.${designIndexName}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, JSON.stringify({ ...index, round }, null, 2), 'utf8');
    await rename(temporaryPath, join(directory, designIndexName));
  }
}

function parseDesignIndex(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return undefined;
  }
}
