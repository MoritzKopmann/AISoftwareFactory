import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findOnPath } from '../../src/cli/find-on-path.js';

describe('findOnPath', () => {
  let firstDirectory: string;
  let secondDirectory: string;

  beforeEach(() => {
    firstDirectory = mkdtempSync(join(tmpdir(), 'aisf-path-first-'));
    secondDirectory = mkdtempSync(join(tmpdir(), 'aisf-path-second-'));
  });

  afterEach(() => {
    rmSync(firstDirectory, { recursive: true, force: true });
    rmSync(secondDirectory, { recursive: true, force: true });
  });

  function addExecutable(directory: string, name: string): string {
    const executablePath = join(directory, name);
    writeFileSync(executablePath, '#!/bin/sh\n');
    chmodSync(executablePath, 0o755);
    return executablePath;
  }

  it('should return the full path of the executable when a directory on the path holds it', () => {
    const executablePath = addExecutable(secondDirectory, 'claude');

    expect(findOnPath('claude', [firstDirectory, secondDirectory].join(delimiter))).toBe(
      executablePath,
    );
  });

  it('should return the first match when two directories hold the command', () => {
    const firstPath = addExecutable(firstDirectory, 'claude');
    addExecutable(secondDirectory, 'claude');

    expect(findOnPath('claude', [firstDirectory, secondDirectory].join(delimiter))).toBe(firstPath);
  });

  it('should return undefined when no directory on the path holds the command', () => {
    expect(findOnPath('claude', firstDirectory)).toBeUndefined();
  });

  it('should return undefined when the file is not executable', () => {
    writeFileSync(join(firstDirectory, 'claude'), 'text');

    expect(findOnPath('claude', firstDirectory)).toBeUndefined();
  });
});
