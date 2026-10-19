import { runProcess } from '../../../../shared/process/run-process.js';
import type { SlotReader } from '../../business/port/contract/slot-reader.js';

const gitTimeoutMilliseconds = 30_000;

export class GitRefSlotReader implements SlotReader {
  async read(checkoutPath: string, slotName: string): Promise<string | undefined> {
    const result = await runProcess(
      'git',
      ['show', `origin/HEAD:.claude/skills/${slotName}/SKILL.md`],
      { workingDirectory: checkoutPath, timeoutMilliseconds: gitTimeoutMilliseconds },
    );
    return result.exitCode === 0 ? result.standardOutput : undefined;
  }
}
