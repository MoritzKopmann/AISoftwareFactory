import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemSlotReader } from '../../../../../src/modules/skills/infra/integrations/file-system-slot-reader.js';

describe('FileSystemSlotReader', () => {
  let checkoutPath: string;

  beforeEach(async () => {
    checkoutPath = await mkdtemp(join(tmpdir(), 'aisf-slot-reader-'));
  });

  afterEach(async () => {
    await rm(checkoutPath, { recursive: true, force: true });
  });

  describe('read', () => {
    it('should return the SKILL.md text when the slot exists', async () => {
      await mkdir(join(checkoutPath, '.claude', 'skills', 'project-architecture'), {
        recursive: true,
      });
      await writeFile(
        join(checkoutPath, '.claude', 'skills', 'project-architecture', 'SKILL.md'),
        '## Stack',
      );

      const text = await new FileSystemSlotReader().read(checkoutPath, 'project-architecture');

      expect(text).toBe('## Stack');
    });

    it('should return undefined when the slot file does not exist', async () => {
      const text = await new FileSystemSlotReader().read(checkoutPath, 'project-architecture');

      expect(text).toBeUndefined();
    });
  });
});
