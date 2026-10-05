import type { RunEndingResponse, TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describeCheckpointPrompt,
  type CheckpointAnswer,
  type CheckpointSend,
} from '../../src/tickets/describe-checkpoint-prompt.js';

const idle: TicketRunResponse = { availability: { kind: 'absent' } };

function endedWith(ending: RunEndingResponse, runId = 'run-1'): TicketRunResponse {
  return {
    ...idle,
    lastRun: {
      id: runId,
      startedAt: '2026-10-04T09:00:00Z',
      endedAt: '2026-10-04T09:10:00Z',
      ending,
    },
  };
}

const checkpoint: RunEndingResponse = {
  kind: 'checkpoint',
  request: 'Should the export include archived runs?',
};

describe('describeCheckpointPrompt', () => {
  it('should hide the prompt when the poll has not answered yet', () => {
    expect(describeCheckpointPrompt(undefined, 'waiting', undefined)).toEqual({ kind: 'hidden' });
  });

  it.each<[string, TicketRunResponse]>([
    ['the ticket has no last run', idle],
    ['the last run ended for another reason', endedWith({ kind: 'stopped' })],
    [
      'the poll shows an active run',
      {
        ...endedWith(checkpoint),
        activeRun: { id: 'run-2', startedAt: '2026-10-04T09:11:00Z', steps: [] },
      },
    ],
  ])('should hide the prompt when %s', (_condition, response) => {
    expect(describeCheckpointPrompt(response, 'waiting', undefined)).toEqual({ kind: 'hidden' });
  });

  it('should show the request with Send held and the catching-up reason when the ticket is not waiting yet', () => {
    expect(describeCheckpointPrompt(endedWith(checkpoint), 'in-progress', undefined)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      request: 'Should the export include archived runs?',
      draft: '',
      counterText: '0 / 10 000',
      hint: 'Plain text. Up to 10 000 characters.',
      atLimit: false,
      sending: false,
      pressable: false,
      reason:
        'Waiting for GitHub to show the ticket as waiting. Send unlocks then, usually within 30 s.',
    });
  });

  it.each<[string, CheckpointAnswer | undefined]>([
    ['no answer is written', undefined],
    ['the answer is whitespace only', { runId: 'run-1', draft: ' \n\t ', send: { kind: 'idle' } }],
  ])(
    'should hold Send and ask for an answer when the ticket is waiting and %s',
    (_case, answer) => {
      expect(describeCheckpointPrompt(endedWith(checkpoint), 'waiting', answer)).toMatchObject({
        kind: 'shown',
        pressable: false,
        reason: 'Write an answer to send it.',
      });
    },
  );

  it('should make Send pressable and count the answer when the ticket is waiting and the answer has text', () => {
    const answer: CheckpointAnswer = {
      runId: 'run-1',
      draft: 'B. Leave archived runs out. Add the hint on the button, as you suggest.',
      send: { kind: 'idle' },
    };
    expect(describeCheckpointPrompt(endedWith(checkpoint), 'waiting', answer)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      request: 'Should the export include archived runs?',
      draft: 'B. Leave archived runs out. Add the hint on the button, as you suggest.',
      counterText: '71 / 10 000',
      hint: 'Plain text. Up to 10 000 characters.',
      atLimit: false,
      sending: false,
      pressable: true,
    });
  });

  it('should group the count in thousands with a space when the answer passes 999 characters', () => {
    const answer: CheckpointAnswer = {
      runId: 'run-1',
      draft: 'a'.repeat(1234),
      send: { kind: 'idle' },
    };
    expect(describeCheckpointPrompt(endedWith(checkpoint), 'waiting', answer)).toMatchObject({
      counterText: '1 234 / 10 000',
      hint: 'Plain text. Up to 10 000 characters.',
      atLimit: false,
    });
  });

  it('should mark the limit and keep Send pressable when the answer reaches 10 000 characters', () => {
    const answer: CheckpointAnswer = {
      runId: 'run-1',
      draft: 'a'.repeat(10_000),
      send: { kind: 'idle' },
    };
    expect(describeCheckpointPrompt(endedWith(checkpoint), 'waiting', answer)).toMatchObject({
      counterText: '10 000 / 10 000',
      hint: 'Limit reached. Shorten the answer to add more.',
      atLimit: true,
      pressable: true,
    });
  });

  it('should hold Send, mark it sending and announce it when the answer is being sent', () => {
    const answer: CheckpointAnswer = { runId: 'run-1', draft: 'B.', send: { kind: 'sending' } };
    expect(describeCheckpointPrompt(endedWith(checkpoint), 'waiting', answer)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      request: 'Should the export include archived runs?',
      draft: 'B.',
      counterText: '2 / 10 000',
      hint: 'Plain text. Up to 10 000 characters.',
      atLimit: false,
      sending: true,
      pressable: false,
      announcement: 'Sending your answer',
    });
  });

  it("should show the server's message and the status, keep the draft and make Send pressable when the send failed", () => {
    const answer: CheckpointAnswer = {
      runId: 'run-1',
      draft: 'B.',
      send: { kind: 'failed', message: 'The run is not waiting for an answer.', status: 409 },
    };
    expect(describeCheckpointPrompt(endedWith(checkpoint), 'waiting', answer)).toEqual({
      kind: 'shown',
      runId: 'run-1',
      request: 'Should the export include archived runs?',
      draft: 'B.',
      counterText: '2 / 10 000',
      hint: 'Plain text. Up to 10 000 characters.',
      atLimit: false,
      sending: false,
      pressable: true,
      error: {
        message: "Couldn't send your answer. The run is not waiting for an answer.",
        detail: '409',
      },
    });
  });

  it('should show the error without a detail when the answer never reached aisf', () => {
    const answer: CheckpointAnswer = {
      runId: 'run-1',
      draft: 'B.',
      send: { kind: 'failed', message: "Can't reach aisf." },
    };
    expect(describeCheckpointPrompt(endedWith(checkpoint), 'waiting', answer)).toMatchObject({
      error: { message: "Couldn't send your answer. Can't reach aisf." },
    });
  });

  it.each<CheckpointSend>([
    { kind: 'idle' },
    { kind: 'sending' },
    { kind: 'failed', message: 'Gone.', status: 409 },
  ])(
    'should start with an empty answer when the $kind answer belongs to an earlier run',
    (send) => {
      const answer: CheckpointAnswer = { runId: 'run-1', draft: 'B.', send };
      expect(describeCheckpointPrompt(endedWith(checkpoint, 'run-2'), 'waiting', answer)).toEqual({
        kind: 'shown',
        runId: 'run-2',
        request: 'Should the export include archived runs?',
        draft: '',
        counterText: '0 / 10 000',
        hint: 'Plain text. Up to 10 000 characters.',
        atLimit: false,
        sending: false,
        pressable: false,
        reason: 'Write an answer to send it.',
      });
    },
  );
});
