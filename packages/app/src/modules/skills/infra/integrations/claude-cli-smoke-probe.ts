import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SmokeProbeReport } from '../../logic/domain/types/smoke-probe-report.js';
import { SkillsSetupError } from '../../logic/errors/skills-setup-error.js';
import type { SmokeProbe } from '../../logic/ports/smoke-probe.js';
import { runClaude } from './run-claude.js';

export type ClaudeCliSmokeProbeOptions = {
  readonly probeDirectory: string;
  readonly pluginDirectory: string;
};

type InitMessage = {
  readonly type?: string;
  readonly subtype?: string;
  readonly claude_code_version?: string;
  readonly skills?: ReadonlyArray<string>;
};

const probeTimeoutMilliseconds = 120_000;
const projectSkillContent = `---
name: project-smoke
description: Proves that a bare project-* skill name resolves.
---

Smoke test only.
`;

function parseMessage(line: string): InitMessage {
  try {
    return JSON.parse(line) as InitMessage;
  } catch {
    return {};
  }
}

export class ClaudeCliSmokeProbe implements SmokeProbe {
  constructor(private readonly options: ClaudeCliSmokeProbeOptions) {}

  async run(): Promise<SmokeProbeReport> {
    const { probeDirectory, pluginDirectory } = this.options;
    const claudeDirectory = join(probeDirectory, '.claude');
    try {
      await this.writeProjectSkill(claudeDirectory);

      // The init message lists the resolved skills; one turn is enough to get it.
      const output = await runClaude(
        [
          '-p',
          'Reply with ok.',
          '--output-format',
          'stream-json',
          '--verbose',
          '--max-turns',
          '1',
          '--no-session-persistence',
          '--plugin-dir',
          pluginDirectory,
        ],
        { workingDirectory: probeDirectory, timeoutMilliseconds: probeTimeoutMilliseconds },
      );

      const initMessage = output
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => parseMessage(line))
        .find((message) => message.type === 'system' && message.subtype === 'init');
      if (initMessage?.claude_code_version === undefined || initMessage.skills === undefined) {
        throw new SkillsSetupError('The claude probe did not report its version and skills');
      }
      return { claudeCodeVersion: initMessage.claude_code_version, skillNames: initMessage.skills };
    } finally {
      // The probe skill exists only to prove bare project-* resolution; no session needs it afterwards.
      await rm(claudeDirectory, { recursive: true, force: true });
    }
  }

  private async writeProjectSkill(claudeDirectory: string): Promise<void> {
    const projectSkillDirectory = join(claudeDirectory, 'skills', 'project-smoke');
    try {
      await mkdir(projectSkillDirectory, { recursive: true });
      await writeFile(join(projectSkillDirectory, 'SKILL.md'), projectSkillContent);
    } catch (error) {
      throw new SkillsSetupError(`Cannot prepare the probe directory: ${String(error)}`);
    }
  }
}
