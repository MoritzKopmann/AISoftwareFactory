import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemDesignCopier } from './file-system-design-copier.js';

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, relativePath)), { recursive: true });
    await writeFile(join(root, relativePath), content);
  }
}

describe('FileSystemDesignCopier', () => {
  let root: string;
  let from: string;
  let to: string;
  const copier = new FileSystemDesignCopier();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'aisf-design-copier-'));
    from = join(root, 'from');
    to = join(root, 'to');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('should copy all files with the same relative paths and bytes when the target does not exist', async () => {
    const files = {
      'index.json': '{"a":1}',
      'tokens.css': ':root{}',
      'boards/main.html': '<main></main>',
      'mocks/card.html': '<link href="../tokens.css">',
    };
    await writeFiles(from, files);

    await copier.copy({ from, to });

    for (const [relativePath, content] of Object.entries(files)) {
      expect(await readFile(join(to, relativePath), 'utf8')).toBe(content);
    }
  });

  it('should keep the existing copy when the target exists', async () => {
    await writeFiles(from, { 'index.json': 'new' });
    await writeFiles(to, { 'index.json': 'old' });

    await copier.copy({ from, to });

    expect(await readFile(join(to, 'index.json'), 'utf8')).toBe('old');
  });

  it('should copy nothing and resolve when the source is missing', async () => {
    await copier.copy({ from, to });

    await expect(stat(to)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
