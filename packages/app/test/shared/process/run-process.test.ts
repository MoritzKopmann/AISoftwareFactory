import { describe, expect, it } from 'vitest';
import { runProcess } from '../../../src/shared/process/run-process.js';

describe('runProcess', () => {
  it('should resolve standard output and exit code 0 when the command succeeds', async () => {
    const result = await runProcess(process.execPath, ['-e', "process.stdout.write('hello')"], {
      timeoutMilliseconds: 5_000,
    });

    expect(result.standardOutput).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  it('should resolve the non-zero exit code without rejecting when the command fails', async () => {
    const result = await runProcess(process.execPath, ['-e', 'process.exit(3)'], {
      timeoutMilliseconds: 5_000,
    });

    expect(result.exitCode).toBe(3);
  });

  it('should resolve standard error when the command writes to it', async () => {
    const result = await runProcess(
      process.execPath,
      ['-e', "process.stderr.write('oops'); process.exit(1)"],
      { timeoutMilliseconds: 5_000 },
    );

    expect(result.standardError).toBe('oops');
    expect(result.exitCode).toBe(1);
  });

  it('should run in the given working directory', async () => {
    const result = await runProcess(
      process.execPath,
      ['-e', 'process.stdout.write(process.cwd())'],
      {
        workingDirectory: '/tmp',
        timeoutMilliseconds: 5_000,
      },
    );

    expect(result.standardOutput).toBe('/tmp');
  });

  it('should reject when the command cannot be spawned', async () => {
    await expect(
      runProcess('aisf-nonexistent-command', [], { timeoutMilliseconds: 5_000 }),
    ).rejects.toThrow();
  });
});
