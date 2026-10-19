import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeAgentSdkRunTranscripts } from './claude-agent-sdk-run-transcripts.js';
import { TranscriptNotFoundError } from '../../business/errors/transcript-not-found-error.js';

const entriesFixturePath = new URL(
  '../../testing/fixtures/sessions/entries-run-transcript.jsonl',
  import.meta.url,
);
const handbacksFixturePath = new URL(
  '../../testing/fixtures/sessions/handbacks-stored.jsonl',
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

  async function recordTranscript(fixture: URL): Promise<void> {
    const projectDirectory = join(
      claudeConfigDirectory,
      'projects',
      worktreePath.replace(/[^a-zA-Z0-9]/g, '-'),
    );
    await mkdir(projectDirectory, { recursive: true });
    await copyFile(fixture, join(projectDirectory, `${sessionId}.jsonl`));
  }

  /** The spike fixture has no `parentUuid`; the SDK rebuilds the conversation from that chain. */
  async function recordChainedTranscript(fixture: URL): Promise<void> {
    const lines = (await readFile(fixture, 'utf8')).trim().split('\n');
    let parentUuid: string | null = null;
    const chained = lines.map((line) => {
      const record = JSON.parse(line) as { uuid: string };
      const withParent = JSON.stringify({ ...record, parentUuid });
      parentUuid = record.uuid;
      return withParent;
    });
    const chainedPath = join(temporaryDirectory, 'chained.jsonl');
    await writeFile(chainedPath, `${chained.join('\n')}\n`);
    await recordTranscript(new URL(`file://${chainedPath}`));
  }

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

    it('should return handback entries and no prompt for them when the transcript holds handbacks', async () => {
      await recordChainedTranscript(handbacksFixturePath);

      const entries = await new ClaudeAgentSdkRunTranscripts().readEntries(sessionId, worktreePath);

      expect(entries.filter(({ kind }) => kind === 'handback')).toMatchObject([
        {
          id: '3d4118bc-8883-4f7c-b124-6e223dc85e8d#0',
          agentId: 'a6cdb2946e5157d4b',
          text: 'FG DONE.',
        },
        { agentId: 'a715d9ff1a28ad5d1', text: 'MID DONE' },
        { agentId: 'a10a077a348fc80e3', text: 'BETWEEN DONE' },
      ]);
      const handbackIds = entries.filter(({ kind }) => kind === 'handback').map(({ id }) => id);
      const promptIds = entries.filter(({ kind }) => kind === 'prompt').map(({ id }) => id);
      expect(promptIds.filter((id) => handbackIds.includes(id))).toEqual([]);
    });

    it('should return no task-notification text when the transcript holds task notifications', async () => {
      await recordChainedTranscript(handbacksFixturePath);

      const entries = await new ClaudeAgentSdkRunTranscripts().readEntries(sessionId, worktreePath);

      expect(JSON.stringify(entries)).not.toContain('<task-notification>');
    });

    it('should throw transcript not found when Claude Code has no transcript for the session', async () => {
      await expect(
        new ClaudeAgentSdkRunTranscripts().readEntries(sessionId, worktreePath),
      ).rejects.toBeInstanceOf(TranscriptNotFoundError);
    });
  });
});
