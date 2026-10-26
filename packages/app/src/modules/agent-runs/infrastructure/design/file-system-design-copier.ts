import { access, cp } from 'node:fs/promises';
import type { DesignCopier } from '../../business/port/design/design-copier.js';

const MISSING_PATH_ERROR_CODE = 'ENOENT';

export class FileSystemDesignCopier implements DesignCopier {
  async copy(paths: { readonly from: string; readonly to: string }): Promise<void> {
    if ((await exists(paths.to)) || !(await exists(paths.from))) {
      return;
    }
    await cp(paths.from, paths.to, { recursive: true });
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    return false;
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === MISSING_PATH_ERROR_CODE;
}
