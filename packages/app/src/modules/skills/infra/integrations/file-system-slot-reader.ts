import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SlotReader } from '../../logic/ports/slot-reader.js';

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export class FileSystemSlotReader implements SlotReader {
  async read(checkoutPath: string, slotName: string): Promise<string | undefined> {
    try {
      return await readFile(join(checkoutPath, '.claude', 'skills', slotName, 'SKILL.md'), 'utf8');
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }
}
