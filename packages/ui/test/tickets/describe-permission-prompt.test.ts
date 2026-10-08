import type { RunEndingResponse, TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describePermissionPrompt,
  settlePermissionAnswer,
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

const T1 = '2026-10-07T10:00:00.000Z';
const T2 = '2026-10-07T10:05:00.000Z';

function liveWait(
  waitingSince: string | undefined = T1,
  waitingFor: NonNullable<NonNullable<TicketRunResponse['activeRun']>['waitingFor']> = {
    kind: 'permission-needed',
    toolName: 'Bash',
    toolInput: { command: 'npm publish' },
  },
  runId = 'run-1',
): TicketRunResponse {
  return {
    ...idle,
    activeRun: {
      id: runId,
      startedAt: '2026-10-07T09:00:00Z',
      steps: [],
      waitingFor,
      waitingSince,
    },
  };
}

const noAnswer: PermissionAnswer = { kind: 'idle' };
const liveWaitId = { runId: 'run-1', waitingSince: T1 };
const fallbackWaitId = { runId: 'run-1' };

describe('describePermissionPrompt', () => {
  it('should hide the prompt when no answer has arrived yet', () => {
    expect(describePermissionPrompt(undefined, 'waiting', noAnswer)).toEqual({ kind: 'hidden' });
  });

  it('should hide the prompt when the last run ended for another reason', () => {
    expect(describePermissionPrompt(endedWith({ kind: 'stopped' }), 'waiting', noAnswer)).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide the prompt when the ticket is stuck on a permission ending', () => {
    expect(describePermissionPrompt(endedWith(bashPrompt), 'stuck', noAnswer)).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide the prompt when the ticket label trails a live permission wait', () => {
    expect(describePermissionPrompt(liveWait(), 'in-progress', noAnswer)).toEqual({
      kind: 'hidden',
    });
  });

  it('should hide the prompt when the live wait is a checkpoint', () => {
    const checkpoint = liveWait(T1, { kind: 'checkpoint', request: 'Pick A or B' });
    expect(describePermissionPrompt(checkpoint, 'waiting', noAnswer)).toEqual({ kind: 'hidden' });
  });

  it('should hide the prompt when the active run has no wait', () => {
    const working: TicketRunResponse = {
      ...endedWith(bashPrompt),
      activeRun: { id: 'run-2', startedAt: '2026-09-30T09:11:00Z', steps: [] },
    };
    expect(describePermissionPrompt(working, 'waiting', noAnswer)).toEqual({ kind: 'hidden' });
  });

  it('should show the live prompt for the active run when the ticket is waiting', () => {
    expect(describePermissionPrompt(liveWait(), 'waiting', noAnswer)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      waitingSince: T1,
      toolName: 'Bash',
      inputText: 'npm publish',
      guidance: true,
      pressable: true,
    });
  });

  it('should show the fallback prompt for the last run when the ticket is waiting', () => {
    const writePrompt: RunEndingResponse = {
      kind: 'permission-needed',
      toolName: 'Write',
      toolInput: { file_path: 'a.ts' },
    };
    expect(describePermissionPrompt(endedWith(writePrompt), 'waiting', noAnswer)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      toolName: 'Write',
      inputText: '{\n  "file_path": "a.ts"\n}',
      guidance: true,
      pressable: true,
    });
  });

  it('should show the input as JSON when a Bash input has no command string', () => {
    const oddBash: RunEndingResponse = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { script: 'ls' },
    };
    expect(describePermissionPrompt(endedWith(oddBash), 'waiting', noAnswer)).toMatchObject({
      inputText: '{\n  "script": "ls"\n}',
    });
  });

  it.each(['allow', 'deny'] as const)(
    'should mark %s as resuming and hold both buttons when that answer was sent for the same wait',
    (decision) => {
      const answer: PermissionAnswer = { kind: 'answering', wait: liveWaitId, decision };
      expect(describePermissionPrompt(liveWait(), 'waiting', answer)).toMatchObject({
        guidance: false,
        pressable: false,
        resuming: decision,
        announcement: 'Resuming the run',
      });
    },
  );

  it('should hold the buttons when a fallback answer was sent for the same run', () => {
    const answer: PermissionAnswer = {
      kind: 'answering',
      wait: fallbackWaitId,
      decision: 'allow',
    };
    expect(describePermissionPrompt(endedWith(bashPrompt), 'waiting', answer)).toMatchObject({
      pressable: false,
      resuming: 'allow',
    });
  });

  it('should show a fresh prompt when the answer belongs to an earlier wait of the same run', () => {
    const answer: PermissionAnswer = { kind: 'answering', wait: liveWaitId, decision: 'allow' };
    const second = describePermissionPrompt(liveWait(T2), 'waiting', answer);
    expect(second).toMatchObject({ guidance: true, pressable: true });
    expect(second).not.toHaveProperty('resuming');
  });

  it('should show a fresh prompt when the answer belongs to an earlier run', () => {
    const answer: PermissionAnswer = { kind: 'answering', wait: liveWaitId, decision: 'allow' };
    expect(
      describePermissionPrompt(liveWait(T1, undefined, 'run-2'), 'waiting', answer),
    ).toMatchObject({ runId: 'run-2', guidance: true, pressable: true });
  });

  it("should show the server's message and the status with both buttons pressable when the answer failed", () => {
    const answer: PermissionAnswer = {
      kind: 'failed',
      wait: liveWaitId,
      message: 'Ticket is not waiting.',
      status: 409,
    };
    expect(describePermissionPrompt(liveWait(), 'waiting', answer)).toMatchObject({
      guidance: false,
      pressable: true,
      error: { message: "Couldn't send your answer. Ticket is not waiting.", detail: '409' },
    });
  });

  it('should show the error without a detail when the answer never reached aisf', () => {
    const answer: PermissionAnswer = {
      kind: 'failed',
      wait: liveWaitId,
      message: "Can't reach aisf.",
    };
    const description = describePermissionPrompt(liveWait(), 'waiting', answer);
    expect(description).toMatchObject({
      error: { message: "Couldn't send your answer. Can't reach aisf." },
    });
    expect(description).not.toHaveProperty('error.detail');
  });
});

describe('settlePermissionAnswer', () => {
  const sent: PermissionAnswer = { kind: 'answering', wait: liveWaitId, decision: 'allow' };

  it('should keep the answer when the poll still shows the same wait', () => {
    expect(settlePermissionAnswer(sent, liveWait())).toBe(sent);
  });

  it('should return idle when the same run shows a later permission wait', () => {
    expect(settlePermissionAnswer(sent, liveWait(T2))).toEqual({ kind: 'idle' });
  });

  it('should return idle when the run shows no wait any more', () => {
    const working: TicketRunResponse = {
      ...idle,
      activeRun: { id: 'run-1', startedAt: '2026-10-07T09:00:00Z', steps: [] },
    };
    expect(settlePermissionAnswer(sent, working)).toEqual({ kind: 'idle' });
  });

  it('should return idle when the run waits on a checkpoint', () => {
    const checkpoint = liveWait(T1, { kind: 'checkpoint', request: 'Pick A or B' });
    expect(settlePermissionAnswer(sent, checkpoint)).toEqual({ kind: 'idle' });
  });

  it('should return idle when a fallback answer meets a resume run without a wait', () => {
    const fallbackAnswer: PermissionAnswer = {
      kind: 'answering',
      wait: fallbackWaitId,
      decision: 'allow',
    };
    const resumed: TicketRunResponse = {
      ...endedWith(bashPrompt),
      activeRun: { id: 'run-2', startedAt: '2026-10-07T10:10:00Z', steps: [] },
    };
    expect(settlePermissionAnswer(fallbackAnswer, resumed)).toEqual({ kind: 'idle' });
  });

  it('should keep a fallback answer while the poll still shows the fallback wait', () => {
    const fallbackAnswer: PermissionAnswer = {
      kind: 'answering',
      wait: fallbackWaitId,
      decision: 'allow',
    };
    expect(settlePermissionAnswer(fallbackAnswer, endedWith(bashPrompt))).toBe(fallbackAnswer);
  });

  it('should keep the answer when the response is undefined', () => {
    expect(settlePermissionAnswer(sent, undefined)).toBe(sent);
  });

  it('should keep a failed answer when the poll still shows the same wait', () => {
    const failed: PermissionAnswer = { kind: 'failed', wait: liveWaitId, message: 'Nope.' };
    expect(settlePermissionAnswer(failed, liveWait())).toBe(failed);
  });

  it('should return an idle answer unchanged', () => {
    const none: PermissionAnswer = { kind: 'idle' };
    expect(settlePermissionAnswer(none, liveWait())).toBe(none);
  });
});

const REASON = 'Posting comments on GitHub issues';
const reasonWaitFor = {
  kind: 'permission-needed',
  toolName: 'Bash',
  toolInput: { command: 'gh issue comment 1' },
  reason: REASON,
} as const;

describe('describePermissionPrompt reason', () => {
  it('should carry the reason when a live wait has one', () => {
    const result = describePermissionPrompt(liveWait(T1, reasonWaitFor), 'waiting', noAnswer);
    expect(result).toMatchObject({ kind: 'shown', reason: REASON });
  });

  it('should carry the reason when the fallback wait has one', () => {
    const result = describePermissionPrompt(endedWith(reasonWaitFor), 'waiting', noAnswer);
    expect(result).toMatchObject({ kind: 'shown', reason: REASON });
  });

  it('should leave out the reason key when the wait has none', () => {
    const live = describePermissionPrompt(liveWait(), 'waiting', noAnswer);
    const fallback = describePermissionPrompt(endedWith(bashPrompt), 'waiting', noAnswer);
    expect(live).not.toHaveProperty('reason');
    expect(fallback).not.toHaveProperty('reason');
  });

  it('should keep the reason when the answer is answering or failed', () => {
    const response = liveWait(T1, reasonWaitFor);
    const answering = describePermissionPrompt(response, 'waiting', {
      kind: 'answering',
      wait: liveWaitId,
      decision: 'allow',
    });
    const failed = describePermissionPrompt(response, 'waiting', {
      kind: 'failed',
      wait: liveWaitId,
      message: 'Nope.',
    });
    expect(answering).toMatchObject({ reason: REASON, pressable: false, resuming: 'allow' });
    expect(failed).toMatchObject({ reason: REASON, pressable: true });
  });
});

describe('settlePermissionAnswer reason', () => {
  it('should keep the answer when the same wait now carries a reason', () => {
    const answer: PermissionAnswer = { kind: 'answering', wait: liveWaitId, decision: 'allow' };
    expect(settlePermissionAnswer(answer, liveWait(T1, reasonWaitFor))).toBe(answer);
  });
});
