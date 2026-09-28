import { describe, expect, it, vi } from 'vitest';
import { copyCommand } from '../../src/shared/copy-command.js';

describe('copyCommand', () => {
  it('should write the command to the clipboard and not select when the clipboard accepts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const selectText = vi.fn();

    await copyCommand('gh auth login', { writeText, selectText });

    expect(writeText).toHaveBeenCalledWith('gh auth login');
    expect(selectText).not.toHaveBeenCalled();
  });

  it('should select the command text when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const selectText = vi.fn();

    await copyCommand('gh auth login', { writeText, selectText });

    expect(selectText).toHaveBeenCalledOnce();
  });

  it('should select the command text when the clipboard is unavailable', async () => {
    const selectText = vi.fn();

    await copyCommand('gh auth login', { writeText: undefined, selectText });

    expect(selectText).toHaveBeenCalledOnce();
  });
});
