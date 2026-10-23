import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemDesignWatcher } from './file-system-design-watcher.js';

const settle = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('FileSystemDesignWatcher', () => {
  let root: string;
  let stops: Array<() => void>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aisf-design-watcher-'));
    mkdirSync(join(root, 'boards'));
    writeFileSync(join(root, 'boards', 'home.html'), 'one');
    stops = [];
  });

  afterEach(() => {
    stops.forEach((stop) => stop());
    rmSync(root, { recursive: true, force: true });
  });

  function watch(directory: string, onChange: (file: string) => void): () => void {
    const stop = new FileSystemDesignWatcher().watch(directory, onChange);
    stops.push(stop);
    return stop;
  }

  it('should report the board once when a board is rewritten', async () => {
    const onChange = vi.fn();
    watch(root, onChange);

    writeFileSync(join(root, 'boards', 'home.html'), 'two');
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    await settle(400);

    expect(onChange.mock.calls).toEqual([['boards/home.html']]);
  });

  it('should report index.json when the index is written', async () => {
    const onChange = vi.fn();
    watch(root, onChange);

    writeFileSync(join(root, 'index.json'), '{}');

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('index.json'));
  });

  it('should not report when a file changes after stop', async () => {
    const onChange = vi.fn();
    const stop = watch(root, onChange);

    stop();
    writeFileSync(join(root, 'boards', 'home.html'), 'two');
    await settle(400);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('should return a stop function and stay silent when the folder is missing', async () => {
    const onChange = vi.fn();

    const stop = watch(join(root, 'gone'), onChange);
    await settle(300);

    expect(stop).toBeTypeOf('function');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should watch the folder when boards is missing', async () => {
    rmSync(join(root, 'boards'), { recursive: true });
    const onChange = vi.fn();
    watch(root, onChange);

    writeFileSync(join(root, 'index.json'), '{}');

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('index.json'));
  });
});
