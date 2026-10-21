import { describe, expect, it, vi } from 'vitest';
import type { OnboardingStart } from './describe-start-onboarding.js';
import { pressStartOnboarding } from './press-start-onboarding.js';

const answer = (status: number, body: unknown) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe('pressStartOnboarding', () => {
  it('should go to starting when pressed after an error', async () => {
    const starts: OnboardingStart[] = [];

    await pressStartOnboarding({ kind: 'unreachable' }, 'o/n', {
      request: answer(409, {}),
      setStart: (start) => starts.push(start),
      navigate: () => undefined,
    });

    expect(starts[0]).toEqual({ kind: 'starting' });
  });

  it('should end on the outcome when the start did not succeed', async () => {
    const starts: OnboardingStart[] = [];

    await pressStartOnboarding({ kind: 'idle' }, 'o/n', {
      request: answer(409, {}),
      setStart: (start) => starts.push(start),
      navigate: () => undefined,
    });

    expect(starts).toEqual([{ kind: 'starting' }, { kind: 'conflict' }]);
  });

  it('should navigate to the new ticket when the start succeeded', async () => {
    const navigate = vi.fn();

    await pressStartOnboarding({ kind: 'idle' }, 'o/n', {
      request: answer(201, { ticketNumber: 7 }),
      setStart: () => undefined,
      navigate,
    });

    expect(navigate).toHaveBeenCalledWith('#/projects/o/n/tickets/7');
  });

  it('should send no request when pressed while starting', async () => {
    const request = answer(201, { ticketNumber: 7 });

    await pressStartOnboarding({ kind: 'starting' }, 'o/n', {
      request,
      setStart: () => undefined,
      navigate: () => undefined,
    });

    expect(request).not.toHaveBeenCalled();
  });
});
