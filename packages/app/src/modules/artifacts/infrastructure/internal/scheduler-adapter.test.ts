import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../../shared/errors.js';
import { PageBusyError } from '../../business/errors/page-busy-error.js';
import { SchedulerAdapter } from './scheduler-adapter.js';

describe('SchedulerAdapter', () => {
  it('should send the text as a checkpoint answer when the scheduler takes it', async () => {
    const calls: Array<{ runId: string; answer: unknown }> = [];
    const answers = new SchedulerAdapter({
      answer: async (runId, answer) => {
        calls.push({ runId, answer });
        return {
          kind: 'answered',
          run: { id: runId, startedAt: '2026-10-06T10:00:00.000Z' },
        };
      },
    });

    await answers.answer('r1', 'tagged');

    expect(calls).toEqual([{ runId: 'r1', answer: { kind: 'checkpoint', text: 'tagged' } }]);
  });

  it('should resolve without error when the scheduler holds the answer', async () => {
    const answers = new SchedulerAdapter({
      answer: async () => ({ kind: 'held', pausedUntil: '2026-10-18T15:00:00.000Z' }),
    });

    await expect(answers.answer('r1', 'tagged')).resolves.toBeUndefined();
  });

  it('should throw PageBusyError when the scheduler refuses with a conflict', async () => {
    const answers = new SchedulerAdapter({
      answer: async () => {
        throw new ConflictError('run is active');
      },
    });

    await expect(answers.answer('r1', 'tagged')).rejects.toThrow(PageBusyError);
  });

  it('should pass on any other error when the scheduler fails', async () => {
    const failure = new Error('boom');
    const answers = new SchedulerAdapter({
      answer: async () => {
        throw failure;
      },
    });

    await expect(answers.answer('r1', 'tagged')).rejects.toBe(failure);
  });
});
