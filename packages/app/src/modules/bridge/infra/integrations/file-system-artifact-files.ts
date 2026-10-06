import { randomUUID } from 'node:crypto';
import { readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { ArtifactFiles } from '../../logic/ports/artifact-files.js';

const indexName = 'index.html';
const stateName = 'state.json';

async function readTextOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

export class FileSystemArtifactFiles implements ArtifactFiles {
  async hasIndex(directory: string): Promise<boolean> {
    try {
      return (await stat(join(directory, indexName))).isFile();
    } catch {
      return false;
    }
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
    } catch {
      return undefined;
    }
  }

  readState(directory: string): Promise<string | undefined> {
    return readTextOrUndefined(join(directory, stateName));
  }

  async writeState(directory: string, state: string): Promise<void> {
    const temporaryPath = join(directory, `.${stateName}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, state, 'utf8');
    await rename(temporaryPath, join(directory, stateName));
  }
}
