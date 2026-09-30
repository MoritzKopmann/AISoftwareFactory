import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  foldTicketRunPoll,
  initialTicketRunPoll,
  type TicketRunPoll,
} from '../../src/tickets/fold-ticket-run-poll.js';

const firstResponse: TicketRunResponse = {
  availability: { kind: 'disabled', reason: '#56 is running.' },
  activeRun: { id: 'run-1', startedAt: '2026-09-30T09:40:00Z', steps: [] },
};
const secondResponse: TicketRunResponse = {
  ...firstResponse,
  activeRun: {
    id: 'run-1',
    startedAt: '2026-09-30T09:40:00Z',
    steps: [{ at: '2026-09-30T09:41:00Z', summary: 'Read a file' }],
  },
};
const answered: TicketRunPoll = {
  response: firstResponse,
  answeredAt: '2026-09-30T09:41:00Z',
  lastPollFailed: false,
};

describe('foldTicketRunPoll', () => {
  it('should take the answer and its arrival time when the poll answers', () => {
    const poll = foldTicketRunPoll(
      initialTicketRunPoll,
      { kind: 'answer', response: firstResponse },
      '2026-09-30T09:41:00Z',
    );

    expect(poll).toEqual(answered);
  });

  it('should keep the last answer and its arrival time and mark the failure when the poll fails', () => {
    const failed = foldTicketRunPoll(answered, { kind: 'request-failed' }, '2026-09-30T09:41:03Z');

    expect(failed).toEqual({ ...answered, lastPollFailed: true });
  });

  it('should take the new answer and clear the failure when the next poll answers', () => {
    const failed = foldTicketRunPoll(answered, { kind: 'request-failed' }, '2026-09-30T09:41:03Z');

    const recovered = foldTicketRunPoll(
      failed,
      { kind: 'answer', response: secondResponse },
      '2026-09-30T09:41:06Z',
    );

    expect(recovered).toEqual({
      response: secondResponse,
      answeredAt: '2026-09-30T09:41:06Z',
      lastPollFailed: false,
    });
  });
});
