import type { RunEndingResponse, TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describePermissionPrompt,
  type PermissionAnswer,
} from '../../src/tickets/describe-permission-prompt.js';

const idle: TicketRunResponse = { availability: { kind: 'absent' } };

function endedWith(ending: RunEndingResponse, runId = 'run-1'): TicketRunResponse {
  return {
    ...idle,
    lastRun: {
      id: runId,
      startedAt: '2026-09-30T09:00:00Z',
      endedAt: '2026-09-30T09:10:00Z',
      ending,
    },
  };
}

const bashPrompt: RunEndingResponse = {
  kind: 'permission-needed',
  toolName: 'Bash',
  toolInput: { command: 'pnpm add zod --filter @aisf/app', description: 'Add zod' },
};

const noAnswer: PermissionAnswer = { kind: 'idle' };

describe('describePermissionPrompt', () => {
  it('should hide the prompt when no answer has arrived yet', () => {
    expect(describePermissionPrompt(undefined, 'stuck', noAnswer)).toEqual({ kind: 'hidden' });
  });

  it('should hide the prompt when the last run ended for another reason', () => {
    expect(describePermissionPrompt(endedWith({ kind: 'stopped' }), 'stuck', noAnswer)).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide the prompt when the ticket is no longer stuck', () => {
    expect(describePermissionPrompt(endedWith(bashPrompt), 'ready', noAnswer)).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide the prompt when the poll shows a new active run', () => {
    const resumed: TicketRunResponse = {
      ...endedWith(bashPrompt),
      activeRun: { id: 'run-2', startedAt: '2026-09-30T09:11:00Z', steps: [] },
    };
    expect(describePermissionPrompt(resumed, 'stuck', noAnswer)).toEqual({ kind: 'hidden' });
  });

  it('should show the Bash command alone with guidance and both buttons pressable when the ticket is stuck on a Bash prompt', () => {
    expect(describePermissionPrompt(endedWith(bashPrompt), 'stuck', noAnswer)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      toolName: 'Bash',
      inputText: 'pnpm add zod --filter @aisf/app',
      guidance: true,
      pressable: true,
    });
  });

  it('should show the input as 2-space JSON when the tool is not Bash', () => {
    const writePrompt: RunEndingResponse = {
      kind: 'permission-needed',
      toolName: 'Write',
      toolInput: { file_path: 'a.ts', content: 'export {};\n' },
    };
    expect(describePermissionPrompt(endedWith(writePrompt), 'stuck', noAnswer)).toMatchObject({
      toolName: 'Write',
      inputText: '{\n  "file_path": "a.ts",\n  "content": "export {};\\n"\n}',
    });
  });

  it('should show the input as JSON when a Bash input has no command string', () => {
    const oddBash: RunEndingResponse = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { script: 'ls' },
    };
    expect(describePermissionPrompt(endedWith(oddBash), 'stuck', noAnswer)).toMatchObject({
      inputText: '{\n  "script": "ls"\n}',
    });
  });

  it.each(['allow', 'deny'] as const)(
    'should mark %s as resuming, stop both buttons and hide the guidance when that answer was sent',
    (decision) => {
      const answer: PermissionAnswer = { kind: 'answering', runId: 'run-1', decision };
      expect(describePermissionPrompt(endedWith(bashPrompt), 'stuck', answer)).toMatchObject({
        guidance: false,
        pressable: false,
        resuming: decision,
        announcement: 'Resuming the run',
      });
    },
  );

  it("should show the server's message and the status with both buttons pressable when the answer failed", () => {
    const answer: PermissionAnswer = {
      kind: 'failed',
      runId: 'run-1',
      message: 'This prompt was already answered.',
      status: 409,
    };
    expect(describePermissionPrompt(endedWith(bashPrompt), 'stuck', answer)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      toolName: 'Bash',
      inputText: 'pnpm add zod --filter @aisf/app',
      guidance: false,
      pressable: true,
      error: {
        message: "Couldn't send your answer. This prompt was already answered.",
        detail: '409',
      },
    });
  });

  it('should show the error without a detail when the answer never reached aisf', () => {
    const answer: PermissionAnswer = {
      kind: 'failed',
      runId: 'run-1',
      message: "Can't reach aisf.",
    };
    expect(describePermissionPrompt(endedWith(bashPrompt), 'stuck', answer)).toMatchObject({
      error: { message: "Couldn't send your answer. Can't reach aisf." },
    });
  });

  it.each<PermissionAnswer>([
    { kind: 'answering', runId: 'run-1', decision: 'allow' },
    { kind: 'failed', runId: 'run-1', message: 'Gone.', status: 409 },
  ])('should show a fresh prompt when the $kind answer belongs to an earlier run', (answer) => {
    expect(describePermissionPrompt(endedWith(bashPrompt, 'run-2'), 'stuck', answer)).toMatchObject(
      { runId: 'run-2', guidance: true, pressable: true },
    );
  });
});
