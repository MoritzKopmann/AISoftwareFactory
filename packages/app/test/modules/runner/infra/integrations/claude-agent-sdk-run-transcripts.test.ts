import { copyFile, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeAgentSdkRunTranscripts } from '../../../../../src/modules/runner/infra/integrations/claude-agent-sdk-run-transcripts.js';
import { TranscriptNotFoundError } from '../../../../../src/modules/runner/logic/errors/transcript-not-found-error.js';

const fixturePath = new URL(
  '../../../../fixtures/sessions/implement-run-transcript.jsonl',
  import.meta.url,
);
const sessionId = '5b0f1c62-7f0e-4d3a-9d0b-2c1f6a8e4b71';

describe('ClaudeAgentSdkRunTranscripts', () => {
  let temporaryDirectory: string;
  let claudeConfigDirectory: string;
  let worktreePath: string;
  let previousConfigDirectory: string | undefined;

  beforeEach(async () => {
    temporaryDirectory = await realpath(await mkdtemp(join(tmpdir(), 'aisf-transcripts-')));
    claudeConfigDirectory = join(temporaryDirectory, 'claude');
    worktreePath = join(temporaryDirectory, 'worktree');
    await mkdir(worktreePath);
    previousConfigDirectory = process.env['CLAUDE_CONFIG_DIR'];
    process.env['CLAUDE_CONFIG_DIR'] = claudeConfigDirectory;
  });

  afterEach(async () => {
    if (previousConfigDirectory === undefined) {
      delete process.env['CLAUDE_CONFIG_DIR'];
    } else {
      process.env['CLAUDE_CONFIG_DIR'] = previousConfigDirectory;
    }
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function recordTranscript(): Promise<void> {
    const projectDirectory = join(
      claudeConfigDirectory,
      'projects',
      worktreePath.replace(/[^a-zA-Z0-9]/g, '-'),
    );
    await mkdir(projectDirectory, { recursive: true });
    await copyFile(fixturePath, join(projectDirectory, `${sessionId}.jsonl`));
  }

  it('should describe the assistant steps in the wording of the running panel when the transcript exists', async () => {
    await recordTranscript();

    const entries = await new ClaudeAgentSdkRunTranscripts().read(sessionId, worktreePath);

    expect(entries).toEqual([
      { summary: "I'll read the ticket first." },
      { summary: 'Bash: gh issue view 137' },
      { summary: 'Edit: /worktrees/aisf/137/src/main.ts' },
    ]);
  });

  it('should throw transcript not found when Claude Code has no transcript for the session', async () => {
    await expect(
      new ClaudeAgentSdkRunTranscripts().read(sessionId, worktreePath),
    ).rejects.toBeInstanceOf(TranscriptNotFoundError);
  });
});
