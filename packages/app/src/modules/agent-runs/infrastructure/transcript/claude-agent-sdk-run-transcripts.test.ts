import { copyFile, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeAgentSdkRunTranscripts } from './claude-agent-sdk-run-transcripts.js';
import { TranscriptNotFoundError } from '../../business/errors/transcript-not-found-error.js';

const fixturePath = new URL(
  '../../testing/fixtures/sessions/implement-run-transcript.jsonl',
  import.meta.url,
);
const entriesFixturePath = new URL(
  '../../testing/fixtures/sessions/entries-run-transcript.jsonl',
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

  async function recordTranscript(fixture: URL = fixturePath): Promise<void> {
    const projectDirectory = join(
      claudeConfigDirectory,
      'projects',
      worktreePath.replace(/[^a-zA-Z0-9]/g, '-'),
    );
    await mkdir(projectDirectory, { recursive: true });
    await copyFile(fixture, join(projectDirectory, `${sessionId}.jsonl`));
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

  describe('readEntries', () => {
    it('should return the prompt, text, tool call and tool result with live ids when the transcript exists', async () => {
      await recordTranscript(entriesFixturePath);

      const entries = await new ClaudeAgentSdkRunTranscripts().readEntries(sessionId, worktreePath);

      expect(entries).toEqual([
        {
          kind: 'prompt',
          id: '00000000-0000-4000-8000-000000000101#0',
          text: '/aisf:implement-ticket 137',
        },
        {
          kind: 'text',
          id: '00000000-0000-4000-8000-000000000103#0',
          text: "I'll read the ticket first.\nThen I plan the work.",
        },
        {
          kind: 'tool-call',
          id: '00000000-0000-4000-8000-000000000103#1',
          toolUseId: 'toolu_01',
          name: 'Bash',
          input: { command: 'gh issue view 137', description: 'Read the ticket' },
        },
        {
          kind: 'tool-result',
          id: '00000000-0000-4000-8000-000000000104#0',
          toolUseId: 'toolu_01',
          isError: false,
          parts: [{ kind: 'text', text: 'Ticket body' }],
        },
      ]);
    });

    it('should throw transcript not found when Claude Code has no transcript for the session', async () => {
      await expect(
        new ClaudeAgentSdkRunTranscripts().readEntries(sessionId, worktreePath),
      ).rejects.toBeInstanceOf(TranscriptNotFoundError);
    });
  });
});
